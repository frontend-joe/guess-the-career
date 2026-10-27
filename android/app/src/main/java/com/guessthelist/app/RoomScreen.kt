package com.guessthelist.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
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
            Text("v${model.state?.stateVersion ?: 0}", fontSize = 11.sp, color = Color.Gray)
        }

        Box(modifier = Modifier.weight(2f).fillMaxWidth()) {
            BoardSection(model)
        }

        if (model.isHost) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { picking = true }) { Text("Choose round") }
                    Button(
                        onClick = { model.startRound() },
                        enabled = model.round?.isPending == true,
                    ) { Text("Start") }
                    Box(Modifier.weight(1f))
                    TextButton(onClick = { model.endGame() }) { Text("End") }
                }
                // Only the host types. Everyone else shouts — which is the
                // game, and is enforced on the server, not here.
                OutlinedTextField(
                    value = guess,
                    onValueChange = { guess = it },
                    label = { Text("Type what they shout…") },
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
        }

        Box(modifier = Modifier.weight(1f).fillMaxWidth().background(Color.Black)) {
            VideoGrid(model)
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
private fun BoardSection(model: RoomViewModel) {
    val round = model.round
    if (round == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                if (model.isHost) "Choose a round, then Start." else "No round yet",
                color = Color.Gray,
            )
        }
        return
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Text(round.board.title, style = MaterialTheme.typography.titleMedium)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            items((1..round.board.target).toList()) { rank ->
                val found = round.board.revealed.firstOrNull { it.rank == rank }
                val hint = round.board.hints.firstOrNull { it.rank == rank }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (found == null) Color(0x14FFFFFF) else Color(0x3822C55E)
                        )
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$rank", color = Color.Gray, fontSize = 12.sp)
                        Text(
                            found?.name ?: "— — —",
                            modifier = Modifier.weight(1f).padding(start = 10.dp),
                        )
                        found?.let {
                            Text(
                                it.value.toInt().toString() + (it.unit?.let { u -> " $u" } ?: ""),
                                color = Color.Gray,
                                fontSize = 12.sp,
                            )
                        }
                        // A clue is a server action, not a local reveal: the
                        // room never sends unfound answers to anyone, and the
                        // hint has to land in the event log so the recording
                        // shows it being taken.
                        if (model.isHost && found == null && hint == null && round.isLive) {
                            TextButton(onClick = { model.takeHint(rank) }) { Text("Clue") }
                        }
                    }
                    hint?.let {
                        Text(
                            clueText(it, round.board.impliedClues),
                            color = Color(0xFFFBBF24),
                            fontSize = 11.sp,
                        )
                    }
                }
            }
        }
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

// Minus whatever the question already gave away — being told the club on
// "Birmingham City's overseas players" is not a hint.
private fun clueText(hint: TakenHint, implied: List<String>): String {
    val fields = listOf(
        "nationality" to "Nationality", "position" to "Position", "years" to "Years",
        "club" to "Club", "squadNumber" to "Shirt", "born" to "Born",
    )
    val parts = fields.mapNotNull { (key, label) ->
        if (implied.contains(key)) null else hint.display(key)?.let { "$label: $it" }
    }
    return if (parts.isEmpty()) "Nothing to give away on this one" else parts.joinToString(" · ")
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
