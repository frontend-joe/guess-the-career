package com.guessthelist.app

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
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
    var confirmingGiveUp by remember { mutableStateOf(false) }
    var showingActions by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Slide the whole room up by exactly the keyboard's height, keeping every
    // part of it the size and shape it already was. Compose animates this inset
    // in step with the IME, so the movement rides the keyboard's own animation
    // rather than chasing it. systemBars rather than safeDrawing deliberately:
    // safeDrawing includes the IME, which would pad and offset for the same
    // keyboard twice.
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .offset { IntOffset(0, -imeBottom) }
            .background(Color(0xFF0A0A0C))
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {

        // Nothing but the occasional video note now that the code has gone, so
        // it takes no space at all unless it has something to say. An empty
        // bar across the top was costing the board a row of its own height.
        model.videoNote?.let {
            Text(
                it,
                fontSize = 11.sp,
                color = Color(0xFFFBBF24),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp),
            )
        }

        // The question, where the web game puts it: across the top, above the
        // board, so it is readable without looking past the pyramid.

        Box(modifier = Modifier.weight(2f).fillMaxWidth()) {
            BoardSection(model)

            // Floating over the board rather than taking a line of its own:
            // it is a remark, not part of the layout, and it should not move
            // anything when it arrives or leaves.
            NearMissToast(
                model.nearMiss?.text,
                Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp),
            )
        }

        // Under the board, not over it: the question is what the board is an
        // answer to, and reading downwards from the pyramid to the words puts
        // them in that order.
        model.round?.let { round ->
            Text(
                round.board.title,
                fontSize = 15.sp,
                fontFamily = AppFonts.Display,
                color = Color.White,
                textAlign = TextAlign.Center,
                // Its own band, a shade up from the app's background. The
                // question is not part of the board and not part of the
                // faces; giving it a surface of its own says which is which
                // without drawing a line between them.
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF191C23))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            )
        }

        // Choosing, starting and ending a round are the host's calls.
        // Guessing is not — the bar below is everyone's.
        // Only what you need BEFORE a round: pick one, start it. It goes away
        // once the round is live, because by then there is nothing left to set
        // up — everything you can still do lives in the one row at the bottom.
        if (model.isHost && model.round?.isLive != true) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(onClick = { picking = true }) { Text("Choose round") }
                Button(
                    onClick = { model.startRound() },
                    enabled = model.pendingInstanceId != null,
                ) { Text("Start") }
                Box(Modifier.weight(1f))
            }
        }


        // Faces and chat share the bottom third rather than splitting it:
        // chat is there for the player whose camera or microphone has failed,
        // which is precisely when their tile is worth nothing anyway.
        // Faces only, for now. The Video/Chat tabs are off while the call is
        // the thing being tested — chat was built for the player whose camera
        // or microphone has failed, and a tab bar costs the faces vertical
        // space in every game where nothing has failed. ChatPanel and its
        // endpoint are untouched, so this is one line away from coming back.
        Box(modifier = Modifier.weight(1f).fillMaxWidth().background(Color(0xFF0A0C10))) {
            VideoGrid(model)
        }

        // Errors only. A verdict used to live here too, which meant a line of
        // text saying "hit" sat above a board that had just turned a row
        // green — the same news, twice, in the worse place.
        model.error?.let {
            Text(
                it,
                fontSize = 11.sp,
                color = Color(0xFFFF6B6B),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // The same two icons iOS shows, and the same colour discipline:
            // red means either "this is off" or "this ends something", and
            // everything else is plain white. The row used to carry red, red,
            // grey, red and blue at once, which gave the eye no hierarchy.
            IconButton(
                onClick = { scope.launch { model.setMicrophone(!model.micOn) } },
                modifier = Modifier.size(42.dp),
            ) {
                Icon(
                    if (model.micOn) Icons.Filled.Mic else Icons.Filled.MicOff,
                    contentDescription = if (model.micOn) "Mute" else "Unmute",
                    tint = if (model.micOn) Color.White else Color(0xFFFF6B6B),
                )
            }
            IconButton(
                onClick = { scope.launch { model.setCamera(!model.cameraOn) } },
                modifier = Modifier.size(42.dp),
            ) {
                Icon(
                    if (model.cameraOn) Icons.Filled.Videocam else Icons.Filled.VideocamOff,
                    contentDescription = if (model.cameraOn) "Turn camera off" else "Turn camera on",
                    tint = if (model.cameraOn) Color.White else Color(0xFFFF6B6B),
                )
            }
            // Everyone types, and the field takes the space the controls do
            // not — instead of sitting on a row of its own under an
            // almost-empty one.
            val live = model.round?.isLive == true
            val canSend = live && guess.isNotBlank()
            Row(
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .clip(RoundedCornerShape(21.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    // Swipe down on the field to put the keyboard away.
                    .pointerInput(Unit) {
                        detectVerticalDragGestures { _, dragAmount ->
                            if (dragAmount > 6f) keyboard?.hide()
                        }
                    },
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BasicTextField(
                    value = guess,
                    onValueChange = { guess = it },
                    enabled = live,
                    singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
                    cursorBrush = SolidColor(Color.White),
                    modifier = Modifier.weight(1f).padding(start = 14.dp),
                    decorationBox = { inner ->
                        if (guess.isEmpty()) {
                            Text("Your guess…", color = Color.Gray, fontSize = 15.sp)
                        }
                        inner()
                    },
                )
                IconButton(
                    onClick = { val raw = guess.trim(); if (raw.isNotEmpty()) { model.guess(raw); guess = "" } },
                    enabled = canSend,
                    modifier = Modifier
                        .padding(end = 5.dp)
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(if (canSend) Color.White else Color.White.copy(alpha = 0.12f)),
                ) {
                    Icon(
                        Icons.Filled.ArrowUpward,
                        contentDescription = "Submit guess",
                        tint = if (canSend) Color.Black else Color.White.copy(alpha = 0.35f),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }

            // Everything else is behind one button. Mute and camera are the
            // two you reach for mid-sentence and they stay out here; the rest
            // are things you do once a game, and four labelled buttons
            // competing for a phone's width meant every one of them was
            // cramped.
            Box {
                IconButton(
                    onClick = { showingActions = true },
                    modifier = Modifier.size(42.dp),
                ) {
                    Icon(
                        Icons.Filled.MoreVert,
                        contentDescription = "More options",
                        tint = Color.White,
                    )
                }
                DropdownMenu(
                    expanded = showingActions,
                    onDismissRequest = { showingActions = false },
                    containerColor = Color(0xFF2C2C2E),
                ) {
                    if (model.isHost && model.round?.isLive == true) {
                        ActionRow(Icons.Filled.Flag, "Give up") {
                            confirmingGiveUp = true; showingActions = false
                        }
                    }
                    if (model.isHost) {
                        ActionRow(Icons.Filled.Share, "Share invite") {
                            shareInvite(context, model.state?.code); showingActions = false
                        }
                    }
                    ActionRow(Icons.AutoMirrored.Filled.Logout, "Leave") {
                        model.leave(); showingActions = false
                    }
                    if (model.isHost) {
                        // Destructive, and last: it closes the room for
                        // everybody, not just whoever tapped it.
                        ActionRow(Icons.Filled.Cancel, "End game", tint = Color(0xFFFF6B6B)) {
                            model.endGame(); showingActions = false
                        }
                    }
                }
            }
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
        model.tiles.forEach { tile ->
            val track = tile.track
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
                        tile.isLocal,
                    )
                } else {
                    Text("camera off", fontSize = 11.sp, color = Color.Gray)
                }
                Text(
                    if (tile.isLocal) "${tile.name} (you)" else tile.name,
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

@Suppress("unused")   // off while the Video/Chat tabs are hidden
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

// Hand the link to whatever the person uses to talk to their mates. A chooser
// rather than a specific app, because that is not ours to decide.
//
// One shape across all three clients — /join/<CODE> — because it is also what
// the website routes and what the two association files claim. A link that
// opens the app on one platform and the website on the other would be the same
// bug twice.
private fun shareInvite(context: Context, code: String?) {
    if (code.isNullOrEmpty()) return
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "Join my Tenable game: https://guessthelist.xyz/join/$code")
    }
    context.startActivity(Intent.createChooser(intent, "Share the invite"))
}


// A menu row with the icon in a fixed leading lane, so every label starts at
// the same x however wide its icon happens to draw.
@Composable
private fun ActionRow(
    icon: ImageVector,
    label: String,
    tint: Color = Color.White,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        leadingIcon = { Icon(icon, contentDescription = null, tint = tint) },
        text = { Text(label, color = tint, fontSize = 16.sp) },
        onClick = onClick,
    )
}


// Its own composable so AnimatedVisibility resolves to the plain overload:
// called inside a Box that sits in a Column, Kotlin picks ColumnScope's and
// refuses the implicit receiver.
@Composable
private fun NearMissToast(text: String?, modifier: Modifier = Modifier) {
    // Remembered so the words do not vanish a frame before the toast does,
    // which turns a fade-out into a flicker of empty pill.
    var lastText by remember { mutableStateOf("") }
    text?.let { lastText = it }

    AnimatedVisibility(
        visible = text != null,
        enter = fadeIn() + slideInVertically { it / 2 },
        exit = fadeOut(),
        modifier = modifier,
    ) {
        Text(
            lastText,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .clip(CircleShape)
                .background(Color(0xFF2A2A2E))
                .padding(horizontal = 16.dp, vertical = 10.dp),
        )
    }
}
