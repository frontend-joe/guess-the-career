package com.guessthelist.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// What happened in this game, after it happened.
//
// A Tenable round is over in ninety seconds and the interesting part is the
// three you did not get. Live, there is no room for that — the board is the
// board and the next round is already being picked. So the review lives here,
// off to one side, and keeps every round the room has played.
//
// A mirror of ios/Sources/Views/HistorySheet.swift. Two native codebases is
// the price of the recording layer; it costs you every screen like this one.

private val DIM = Color(0xFF8A8A93)
private val FAINT = Color(0xFF5C5C66)
private val FOUND = Color(0xFF4ADE80)

@Composable
fun HistoryDialog(model: RoomViewModel, onDismiss: () -> Unit) {
    var rounds by remember { mutableStateOf<List<HistoryRound>?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    // Null means the list; a round means that round's answers. One dialog
    // rather than two, so Back lands on the list the way it should.
    var opened by remember { mutableStateOf<HistoryRound?>(null) }
    var showingPlayer by remember { mutableStateOf<HistoryAnswer?>(null) }

    LaunchedEffect(Unit) {
        val seat = model.seat ?: return@LaunchedEffect
        // Newest first. You are nearly always here to look at the round that
        // just finished, and scrolling to the bottom to find it is the wrong
        // default for every game longer than three rounds.
        runCatching { Api.history(seat).reversed() }
            .onSuccess { rounds = it }
            .onFailure { failure = it.message; rounds = emptyList() }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(opened?.title ?: "History", fontSize = 16.sp) },
        confirmButton = {
            TextButton(onClick = { if (opened != null) opened = null else onDismiss() }) {
                Text(if (opened != null) "Back" else "Done")
            }
        },
        text = {
            val list = rounds
            when {
                list == null -> CircularProgressIndicator(Modifier.padding(24.dp))
                failure != null -> Text(failure!!, fontSize = 13.sp, color = DIM)
                // Before the first round ends there is genuinely nothing here,
                // and saying so is better than an empty list that looks like a
                // failed request.
                list.isEmpty() -> Text(
                    "Nothing to review yet. Finished rounds show up here with their answers.",
                    fontSize = 13.sp,
                    color = DIM,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                )
                opened != null -> AnswerList(opened!!) { showingPlayer = it }
                else -> RoundList(list) { opened = it }
            }
        },
    )

    showingPlayer?.let { answer ->
        PlayerCardDialog(
            footballerId = answer.footballerId,
            name = answer.name,
            onDismiss = { showingPlayer = null },
        )
    }
}

/** Who said it, or that nobody did. */
@Composable
private fun WhoBadge(text: String, tint: Color) {
    Text(
        text,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = tint,
        maxLines = 1,
        modifier = Modifier
            .padding(start = 6.dp)
            .clip(RoundedCornerShape(50))
            .background(tint.copy(alpha = 0.15f))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

@Composable
private fun RoundList(rounds: List<HistoryRound>, onOpen: (HistoryRound) -> Unit) {
    LazyColumn(Modifier.fillMaxHeight(0.7f)) {
        items(rounds, key = { it.instanceId }) { round ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpen(round) }
                    .padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(round.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(round.score, fontSize = 11.sp, color = DIM)
                }
                // The score as a shape, not just a number: a round you cleaned
                // up and one you were battered on should be told apart from
                // across the room.
                Text(
                    "${round.found}",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (round.found == round.target) FOUND else DIM,
                )
            }
        }
    }
}

@Composable
private fun AnswerList(round: HistoryRound, onOpen: (HistoryAnswer) -> Unit) {
    val board = round.answers.filter { it.onBoard }
    // Everything the round froze below the board, on a ranked one. Empty on
    // an unordered round, where every frozen name was on the board.
    val tail = round.answers.filterNot { it.onBoard }

    LazyColumn(Modifier.fillMaxHeight(0.7f)) {
        items(board, key = { it.rank }) { answer ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    // Any row opens, found or not: "who on earth is Ryan Donk"
                    // is exactly the question this screen exists to answer,
                    // and refusing the tap on a missed name answers it for
                    // nobody.
                    .clickable { onOpen(answer) }
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Only where a rank is a real thing. On an unordered round it
                // is the order the pool happened to be frozen in and means
                // nothing — printing it would invent a ranking the game never
                // had.
                if (round.ordered) {
                    Text(
                        "${answer.rank}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = DIM,
                        textAlign = TextAlign.End,
                        modifier = Modifier.width(22.dp),
                    )
                }
                // The name, and against it whoever said it. Beside rather
                // than across the row: the pair is one fact — this answer,
                // this player — and reading it meant crossing the gap to the
                // far edge and back on every row.
                Row(
                    Modifier.weight(1f).padding(start = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        answer.name,
                        fontSize = 14.sp,
                        fontWeight = if (answer.found) FontWeight.SemiBold else FontWeight.Normal,
                        // Dimmed rather than coloured. A missed answer is not
                        // an error and should not read as one; it is simply a
                        // name that did not get said.
                        color = if (answer.found) Color.Unspecified else DIM,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        // The answer outranks the badge for room. A truncated
                        // player name is the one thing on this screen nobody
                        // can reconstruct; a truncated "Blessing Ka…" is
                        // still obviously Blessing.
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    WhoBadge(answer.foundBy ?: "Missed", if (answer.found) FOUND else DIM)
                }
                // Just the number out here now. One column of digits down the
                // edge, which is what makes it scannable.
                badgeText(answer.value, answer.unit, answer.display)?.let {
                    Text(it, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = DIM)
                }
            }
        }
        // The rest of the frozen list, on a ranked round. Under its own
        // heading rather than running on from the tenth, because these names
        // are a different kind of thing: not answers that were missed,
        // answers that were never on offer. Run together, a room that lost 7
        // of 10 would be told it had lost 47 of 50.
        if (tail.isNotEmpty()) {
            item {
                Text(
                    "Near Misses",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = DIM,
                    modifier = Modifier.padding(top = 18.dp, bottom = 6.dp),
                )
            }
            items(tail, key = { it.rank }) { answer ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpen(answer) }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${answer.rank}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = FAINT,
                        textAlign = TextAlign.End,
                        modifier = Modifier.width(22.dp),
                    )
                    Text(
                        answer.name,
                        fontSize = 14.sp,
                        color = DIM,
                        modifier = Modifier.weight(1f).padding(start = 8.dp),
                    )
                    // On a near miss the number is the whole reason the row
                    // is listed: 46 appearances against the 47 that made the
                    // board is the argument the room is having.
                    //
                    // And no badge beside the name. "Missed" would be an
                    // accusation about a name the board never had a slot for.
                    badgeText(answer.value, answer.unit, answer.display)?.let {
                        Text(it, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FAINT)
                    }
                }
            }
            item {
                Text(
                    "Ranked below the board when the round was frozen. Saying one of these counted as a near miss, not an answer.",
                    fontSize = 11.sp,
                    color = FAINT,
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            }
        }
        // An unordered round froze its whole pool, which on a nationality
        // board is two hundred names. Saying how many are not listed is more
        // honest than a list that simply stops.
        if (round.more > 0) {
            item {
                Text(
                    "${round.more} more would also have counted.",
                    fontSize = 11.sp,
                    color = DIM,
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            }
        }
    }
}
