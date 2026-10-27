package com.guessthelist.app

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.livekit.android.compose.ui.VideoTrackView
import io.livekit.android.room.participant.LocalParticipant
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoTrack
import kotlinx.coroutines.launch

// The podcast composition, live: board over the top two thirds, faces across
// the bottom third. Playing layout and recorded layout stay the same, so the
// shape of the video is tested every time anyone plays rather than discovered
// when the compositor is written.
@Composable
fun RoomScreen(model: RoomViewModel) {
    var guess by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    var chatTab by remember { mutableStateOf(false) }
    // The newest message id already seen, so the Chat tab can say how many
    // arrived while you were watching faces.
    var seenMessageId by remember { mutableIntStateOf(0) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF0A0A0C)).safeDrawingPadding()) {

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                model.state?.code.orEmpty(),
                fontFamily = FontFamily.Monospace,
                fontSize = 20.sp,
                color = Color(0xFF4ADE80),
            )
            Box(Modifier.weight(1f))
            model.videoNote?.let { Text(it, fontSize = 11.sp, color = Color(0xFFFBBF24)) }
            // The state version was a debugging aid that earned its place
            // during Phase 2 and stopped earning it once the sync stopped
            // being the thing under test.
        }

        // The question, where the web game puts it: across the top, above the
        // board, so it is readable without looking past the pyramid.
        model.round?.let { round ->
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    round.board.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "${round.board.revealed.size} / ${round.board.target} found",
                    fontSize = 11.sp,
                    color = Color.Gray,
                )
            }
        }

        Box(modifier = Modifier.weight(2f).fillMaxWidth()) {
            BoardSection(model)
        }

        // Choosing, starting and ending a round are the host's calls.
        // Guessing is not — the bar below is everyone's.
        if (model.isHost) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(onClick = { picking = true }) { Text("Choose round") }
                Button(
                    onClick = { model.startRound() },
                    enabled = model.round?.isPending == true,
                ) { Text("Start") }
                Box(Modifier.weight(1f))
                TextButton(onClick = { shareCode(context, model.state?.code) }) { Text("Share") }
                TextButton(onClick = { model.endGame() }) { Text("End") }
            }
        }

        // Everyone types. You can still shout, and mostly will, but a player
        // whose microphone has failed can now play rather than watch.
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            OutlinedTextField(
                value = guess,
                onValueChange = { guess = it },
                label = { Text("Your guess…") },
                singleLine = true,
                enabled = model.round?.isLive == true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        val raw = guess.trim()
                        if (raw.isNotEmpty()) { model.guess(raw); guess = "" }
                    },
                    enabled = model.round?.isLive == true && guess.isNotBlank(),
                ) { Text("Guess") }
                model.lastGuess?.let {
                    Text(
                        it.verdict,
                        color = verdictColour(it.verdict),
                        modifier = Modifier.align(Alignment.CenterVertically),
                    )
                }
            }
        }

        // Faces and chat share the bottom third rather than splitting it:
        // chat is there for the player whose camera or microphone has failed,
        // which is precisely when their tile is worth nothing anyway.
        Column(modifier = Modifier.weight(1f).fillMaxWidth().background(Color.Black)) {
            val messages = model.state?.messages.orEmpty()
            val unread = messages.count { it.id > seenMessageId }
            TabRow(selectedTabIndex = if (chatTab) 1 else 0, containerColor = Color(0xFF0A0A0C)) {
                Tab(
                    selected = !chatTab,
                    onClick = { chatTab = false },
                    text = { Text("Video", fontSize = 13.sp) },
                )
                Tab(
                    selected = chatTab,
                    onClick = {
                        chatTab = true
                        seenMessageId = messages.lastOrNull()?.id ?: seenMessageId
                    },
                    text = {
                        Text(if (unread > 0) "Chat ($unread)" else "Chat", fontSize = 13.sp)
                    },
                )
            }
            LaunchedEffect(chatTab, messages.lastOrNull()?.id) {
                if (chatTab) seenMessageId = messages.lastOrNull()?.id ?: seenMessageId
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (chatTab) ChatPanel(model, messages) else VideoGrid(model)
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = { scope.launch { model.setMicrophone(!model.micOn) } }) {
                Text(if (model.micOn) "Mute" else "Muted")
            }
            TextButton(onClick = { scope.launch { model.setCamera(!model.cameraOn) } }) {
                Text(if (model.cameraOn) "Stop video" else "Video off")
            }
            Box(Modifier.weight(1f))
            model.error?.let { Text(it, fontSize = 11.sp, color = Color(0xFFFF6B6B)) }
            TextButton(onClick = { model.leave() }) { Text("Leave") }
        }
    }

    if (picking) {
        RoundPickerDialog(
            onDismiss = { picking = false },
            onPick = { model.freezeRound(it); picking = false },
        )
    }
}

@Composable
private fun VideoGrid(model: RoomViewModel) {
    if (model.tiles.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(model.videoNote ?: "connecting…", color = Color.DarkGray, fontSize = 12.sp)
        }
        return
    }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        model.tiles.forEach { participant ->
            val track = participant
                .getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF16161A)),
                contentAlignment = Alignment.Center,
            ) {
                val lkRoom = model.room
                if (track != null && lkRoom != null) {
                    // Positional: the published parameter names are not
                    // what they look like from the Java signature.
                    VideoTrackView(
                        track,
                        Modifier.fillMaxSize(),
                        lkRoom,
                        participant is LocalParticipant,
                    )
                } else {
                    Text("camera off", fontSize = 11.sp, color = Color.Gray)
                }
                Text(
                    participant.name ?: participant.identity?.value ?: "?",
                    fontSize = 10.sp,
                    color = Color.White,
                    modifier = Modifier.align(Alignment.BottomStart).padding(4.dp),
                )
            }
        }
    }
}

private fun verdictColour(verdict: String): Color = when (verdict) {
    "hit" -> Color(0xFF4ADE80)
    "near" -> Color(0xFFFBBF24)
    "duplicate" -> Color(0xFF60A5FA)
    else -> Color(0xFFFF6B6B)
}

@Composable
private fun RoundPickerDialog(onDismiss: () -> Unit, onPick: (Int) -> Unit) {
    var rounds by remember { mutableStateOf<List<ScheduledRound>>(emptyList()) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        rounds = runCatching { Api.scheduledRounds() }.getOrDefault(emptyList())
    }

    val matches = remember(query, rounds) {
        val q = query.trim().lowercase()
        (if (q.isEmpty()) rounds else rounds.filter { "${it.date} ${it.title}".lowercase().contains(q) })
            .take(200)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose a round") },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Filter rounds") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.fillMaxHeight(0.7f)) {
                    items(matches) { round ->
                        TextButton(onClick = { onPick(round.roundId) }) {
                            Text("${round.date} — ${round.title}", fontSize = 13.sp)
                        }
                    }
                }
            }
        },
    )
}

@Composable
private fun ChatPanel(model: RoomViewModel, messages: List<ChatMessage>) {
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    // Follow the conversation, the way every chat does. Keyed on the last id
    // rather than the count, so a resync that replaces the window still
    // scrolls correctly.
    LaunchedEffect(messages.lastOrNull()?.id) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    Column(Modifier.fillMaxSize()) {
        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth().padding(12.dp)) {
                Text(
                    "No messages yet. Type here if your mic or camera isn't working.",
                    fontSize = 12.sp,
                    color = Color.Gray,
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(messages, key = { it.id }) { message ->
                    val mine = message.participantId == model.seat?.participantId
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
                    ) {
                        Text(
                            message.displayName,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray,
                        )
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (mine) Color(0xFF3B2E7A) else Color(0xFF2B2B2F))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(message.body, fontSize = 14.sp, color = Color.White)
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                placeholder = { Text("Message") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = { model.sendChat(draft); draft = "" },
                enabled = draft.isNotBlank(),
            ) { Text("Send") }
        }
    }
}

// Hand the code to whatever the person uses to talk to their mates. A chooser
// rather than a specific app, because that is not ours to decide.
private fun shareCode(context: Context, code: String?) {
    if (code.isNullOrEmpty()) return
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "Join my Tenable game — code $code")
    }
    context.startActivity(Intent.createChooser(intent, "Share the code"))
}
