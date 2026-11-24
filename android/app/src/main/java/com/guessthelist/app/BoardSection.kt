package com.guessthelist.app

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.AlertDialog
import androidx.compose.material.icons.Icons
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// A port of PyramidRow from client/src/pages/TenablePage.tsx, kept faithful to
// it: the same widths, the same two gradients, the same value badge. Three
// clients drawing the same board differently would be three chances for the
// recorded video to match none of them.

private val GreenTop = Color(0xFF4ADE80)    // tailwind green-400
private val GreenBottom = Color(0xFF16A34A) // green-600
private val VioletTop = Color(0xFF8B5CF6)   // violet-500
private val VioletBottom = Color(0xFF6D28D9) // violet-700

// Revealed by giving up. Deliberately colourless next to the green: the board
// should read at a glance as what you got and what you didn't, and a second
// bright colour would make a missed answer look like a prize.
private val MissedTop = Color(0xFF475569)    // slate-600
private val MissedBottom = Color(0xFF334155) // slate-700

/** 56% at rank 1, widening by 4.9 points a row — the web game's formula. */
private fun widthFraction(rank: Int): Float =
    minOf(1f, (56f + (rank - 1) * 4.9f) / 100f)

@Composable
fun BoardSection(model: RoomViewModel) {
    val round = model.round
    // Which row's clue is on screen. A clue is a dialog rather than text
    // crammed into a capsule, so it can be read, dismissed, and opened again
    // later — the inline version was gone the moment the row was reused, and
    // unreadable before that.
    var showingClue by remember { mutableStateOf<Int?>(null) }
    // Which found player's card is open, as (id, name) so the dialog can show
    // the name while the career loads.
    // The id is nullable: a row can carry a name the board cannot put a
    // footballer to, and that row still opens and says so.
    var showingPlayer by remember { mutableStateOf<Pair<Int?, String>?>(null) }
    // Drives the wave. Counts up forever; each row works out its own moment
    // from it, so there is one timer for the board rather than ten.
    var wave by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(10_000)
            wave += 1
        }
    }
    // Clue ranks this screen has already opened by itself. A clue taken
    // anywhere in the room opens here too, but only once, and never for the
    // ones already on the board when this screen appeared — joining a round
    // mid-way should not fire four dialogs at you.
    var announced by remember { mutableStateOf<Set<Int>?>(null) }
    if (round == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                if (model.isHost) "Choose a round, then Start." else "No round yet",
                color = Color.Gray,
            )
        }
        return
    }

    Column(
        // 32, not 10: the pyramid is 44dp narrower than the screen it sits on,
        // matching iOS. Every row is a fraction of what is left, so the widest
        // loses the full 44 and the narrowest about 25.
        Modifier.fillMaxSize().padding(horizontal = 32.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // What sits in a given SLOT, which is not the same as a given rank. An
        // ordered board is a ranking: rank 3 belongs in slot 3 and nowhere
        // else. An unordered one — "name any ten of this squad" — has no
        // ranking at all, so the names fill from the top as they are found.
        // The server hands them over already in the order the board wants,
        // which is the only place it can be decided: sorting by rank here made
        // a later answer appear ABOVE an earlier one, because an unordered
        // round's ranks are positions in a pool longer than the board.
        val inOrder = round.board.revealed
        for (rank in 1..round.board.target) {
            val slotAnswer = if (round.board.ordered) {
                round.board.revealed.firstOrNull { it.rank == rank }
            } else {
                inOrder.getOrNull(rank - 1)
            }
            val hasClue = round.board.hints.any { it.rank == rank }
            val answered = slotAnswer != null
            PyramidRow(
                rank = rank,
                // A number on an unordered board claims a ranking that is not
                // there, and this one was asking people to name the squad in
                // order of shirt number.
                showsRank = round.board.ordered,
                answer = slotAnswer,
                hasClue = hasClue,
                // Only football rounds have anything behind a blank slot. An
                // authored round's answers are a list somebody typed, with no
                // career to hint at, so a clue there opens an empty card.
                canHint = model.isHost && round.isLive && round.board.category == "football",
                // Bottom to top: rank 10 goes first, rank 1 last. The board
                // reads downwards, so a wave running the other way is
                // movement rather than a second way of reading it.
                waveTick = wave,
                waveDelayMs = ((round.board.target - rank) * 110).toLong(),
                onClue = {
                    // The host takes a clue; everyone's screen then opens it.
                    // Anyone may reopen one already taken, after the round has
                    // ended too.
                    when {
                        // Reopening one already taken — nobody else needs to
                        // see that.
                        hasClue -> showingClue = rank
                        // Not opened here. The clue lands in the event log,
                        // comes back in the next state, and opens on every
                        // screen including this one.
                        model.isHost && round.isLive && !answered -> model.takeHint(rank)
                    }
                },
                // Tapping a row that has a name on it opens that player's
                // career. Anyone can, at any time, including after the round
                // has ended and including on an answer revealed by giving up
                // — the card settles the "who even is that" the board starts.
                // Opens for ANY row with a name on it, including one the board
                // cannot identify: a row that looks tappable and does nothing
                // is worse than one that opens and says it knows nothing.
                onClick = {
                    slotAnswer?.let { showingPlayer = it.footballerId to it.name }
                },
                modifier = Modifier.weight(1f).fillMaxWidth(widthFraction(rank)),
            )
        }
    }

    // The host spends the clue; everyone reads it. It arrives through the
    // room state like everything else, so there is no separate message to miss
    // and a client that resyncs still gets it.
    val hintRanks = round.board.hints.map { it.rank }
    LaunchedEffect(hintRanks) {
        val seen = announced
        if (seen == null) {
            announced = hintRanks.toSet()
        } else {
            val fresh = hintRanks.filterNot { seen.contains(it) }
            announced = seen + hintRanks
            fresh.maxOrNull()?.let { showingClue = it }
        }
    }

    showingClue?.let { rank ->
        ClueDialog(
            rank = rank,
            hint = round.board.hints.firstOrNull { it.rank == rank },
            impliedClues = round.board.impliedClues,
            canReveal = model.isHost && round.isLive,
            onReveal = { model.takeInitials(rank) },
            onDismiss = { showingClue = null },
        )
    }

    showingPlayer?.let { (id, name) ->
        PlayerCardDialog(footballerId = id, name = name, onDismiss = { showingPlayer = null })
    }
}

// A clue, laid out as the few facts it actually is. The capsule version ran
// them together on one line inside a shape that had no room for them, at a
// size that shrank with the board.
@Composable
private fun ClueDialog(
    rank: Int,
    hint: TakenHint?,
    impliedClues: List<String>,
    /** Whether the person reading this can spend the initials on it: the
     *  host, in a round that is still being played. */
    canReveal: Boolean,
    onReveal: () -> Unit,
    onDismiss: () -> Unit,
) {
    // Transfer fields first: on a transfer round they are the answer's whole
    // context, and the career fields below are mostly absent.
    val fields = listOf(
        "fee" to "Fee", "fromClub" to "From", "toClub" to "To",
        "nationality" to "Nationality", "position" to "Position", "years" to "Years",
        "club" to "Club", "squadNumber" to "Shirt", "born" to "Born",
    )
    // A clue that restates the question is not a clue: if the round is
    // "Italian forwards", nationality and position are already known.
    val rows = fields.mapNotNull { (key, label) ->
        if (impliedClues.contains(key)) null else hint?.display(key)?.let { label to it }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Clue for $rank") },
        text = {
            // One column rather than two branches, because the initials row
            // belongs on a clue with nothing else in it most of all: a round
            // that has already told you the nationality and the position has
            // nothing left to give except the name.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                rows.forEach { (label, value) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(label, color = Color.Gray, fontSize = 14.sp)
                        Text(value, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                }
                // The one clue the host decides on at the time. Everything
                // above it was settled when the round was frozen; this is
                // spent, so it is a button until somebody presses it and a
                // fact afterwards.
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 40.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Initials", color = Color.Gray, fontSize = 14.sp)
                    val initials = hint?.initials
                    when {
                        initials != null ->
                            Text(initials, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        canReveal -> Button(onClick = onReveal) { Text("Reveal") }
                        // Said rather than left out, so the room knows there
                        // is one more thing to ask the host for.
                        else -> Text("Hidden", color = Color.DarkGray, fontSize = 15.sp)
                    }
                }
                if (rows.isEmpty()) {
                    Text(
                        "Everything else known about this one is already in the question.",
                        color = Color.Gray,
                        fontSize = 13.sp,
                    )
                }
            }
        },
        // An X, not "Done": there is nothing to be done here. The dialog
        // shows a clue and the only thing you can do with it is close it.
        confirmButton = {
            IconButton(onClick = onDismiss) {
                Icon(Icons.Filled.Close, contentDescription = "Close")
            }
        },
    )
}

@Composable
private fun PyramidRow(
    rank: Int,
    showsRank: Boolean,
    answer: RevealedAnswer?,
    /** Whether a clue has been taken. The clue itself lives in the dialog. */
    hasClue: Boolean,
    canHint: Boolean,
    /** Bumped once every ten seconds for the whole board. */
    waveTick: Int,
    /** This row's place in the wave, behind the one below it. */
    waveDelayMs: Long,
    /** Takes the clue, or reopens one already taken. */
    onClue: () -> Unit,
    /** Opens the player's career. Only does anything on a row with a name. */
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // 0 at rest, 1 at the top of this row's part of the wave.
    val lift = remember { Animatable(0f) }
    LaunchedEffect(waveTick) {
        if (waveTick == 0) return@LaunchedEffect
        delay(waveDelayMs)
        // Up a little faster than it comes down, so it reads as a rise and a
        // settle rather than a pulse. Slower than the first attempt, which
        // crossed the board quickly enough that you saw a flicker rather than
        // something travelling.
        lift.animateTo(1f, tween(280, easing = LinearEasing))
        lift.animateTo(0f, tween(420, easing = LinearEasing))
    }
    val brush = when {
        answer == null -> Brush.verticalGradient(listOf(VioletTop, VioletBottom))
        answer.missed -> Brush.verticalGradient(listOf(MissedTop, MissedBottom))
        else -> Brush.verticalGradient(listOf(GreenTop, GreenBottom))
    }

    val interaction = remember { MutableInteractionSource() }
    val holding by interaction.collectIsPressedAsState()
    // Whether this row offers a clue at all.
    //
    // The host sees one on every blank slot, because spending it is theirs to
    // decide. Everybody else sees one only where a clue has already been
    // taken — a button they cannot press is not information, it is a tease,
    // and the room finding out which rows the host CONSIDERED is not
    // something the game should leak.
    val showsClueButton = answer == null && (canHint || hasClue)
    // A row that does nothing must not shrink under the finger and promise
    // that it does. Only a found row is pressable now; a blank one carries a
    // button instead.
    val scale by animateFloatAsState(
        targetValue = if (holding && answer != null) 0.97f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "press",
    )
    val haptics = LocalHapticFeedback.current

    Box(
        modifier = modifier
            .graphicsLayer {
                val s = if (holding && answer != null) scale else scale * (1f + 0.055f * lift.value)
                scaleX = s; scaleY = s
            }
            .clip(CircleShape)
            .background(brush)
            // Tap a row you have found to read that player's career. A blank
            // row has no gesture: its clue is a button, not a hold.
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = answer != null,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        // The row stands up and sits back down, like someone in the wave: a
        // little bigger and a little brighter, then back. A band of light
        // sliding across was tried first and read as a sheen ON the row
        // rather than the row itself moving.
        if (lift.value > 0f) {
            Box(Modifier.matchParentSize().background(Color.White.copy(alpha = 0.16f * lift.value)))
        }

        when {
            answer != null -> Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                modifier = Modifier.padding(horizontal = 12.dp),
            ) {
                Text(
                    answer.name.uppercase(),
                    fontSize = 14.sp,
                    fontFamily = AppFonts.Display,
                    color = if (answer.missed) Color.White.copy(alpha = 0.75f) else Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                valueText(answer)?.let { badge ->
                    Box(
                        Modifier
                            .sizeIn(minWidth = 24.dp, minHeight = 22.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.35f))
                            .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(badge, fontSize = 11.sp, fontFamily = AppFonts.Display, color = Color.White)
                    }
                }
            }
            // The rank stays centred on the row rather than being pushed
            // along by the button, so the column of numbers reads straight
            // down whether or not a row has a clue on it.
            showsRank -> Text(
                "$rank",
                fontSize = 17.sp,
                fontFamily = AppFonts.Display,
                color = Color.White.copy(alpha = 0.95f),
            )
            else -> Unit
        }

        if (showsClueButton) {
            Box(Modifier.matchParentSize(), contentAlignment = Alignment.CenterEnd) {
                ClueButton(
                    taken = hasClue,
                    rank = rank,
                    onClick = {
                        // Causality: fired on the event that opens the clue,
                        // not on the touch that requested it.
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onClue()
                    },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
    }
}

/** Solid once the clue is up, outlined while it is still the host's to spend
 *  — so a host glancing down the board can see what they have already given
 *  away without opening anything. */
@Composable
private fun ClueButton(taken: Boolean, rank: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .heightIn(min = 22.dp)
            .clip(CircleShape)
            .background(if (taken) Color.White.copy(alpha = 0.92f) else Color.Black.copy(alpha = 0.28f))
            .border(
                width = 1.dp,
                color = if (taken) Color.Transparent else Color.White.copy(alpha = 0.45f),
                shape = CircleShape,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 4.dp)
            .semantics {
                contentDescription =
                    if (taken) "Open the clue for $rank" else "Take a clue for $rank"
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Clue",
            fontSize = 10.sp,
            fontFamily = AppFonts.Display,
            color = if (taken) VioletBottom else Color.White,
        )
    }
}

/** What goes in the badge, or nothing at all. */
private fun valueText(answer: RevealedAnswer): String? {
    // A shirt number is not a score. On a squad round the board is not ranked
    // by it — it is not ranked by anything — so putting "8 shirt" next to a
    // name states a fact nobody asked for and makes the row look like it
    // placed eighth.
    if (answer.unit == "shirt") return null
    // A transfer fee is a price, not a count. "37500000 fee" is unreadable at
    // a glance and wraps the badge onto two lines; "37.5m" is the number
    // people actually say.
    if (answer.unit == "fee") return money(answer.value)
    // An authored round already knows how its number should read, and the raw
    // one would not fit the badge: 17098246 km² is not a thing anybody can take
    // in at a glance.
    answer.display?.takeIf { it.isNotEmpty() }?.let { return it }
    val number = answer.value.toInt().toString()
    val unit = answer.unit
    // No unit and no number is an unordered round — "name any ten of these" is
    // not ranked by anything, and a zero next to a correct answer reads as
    // having scored nothing.
    if (unit.isNullOrEmpty()) return if (answer.value == 0.0) null else number
    return "$number $unit"
}

/** A fee as people say it: 37.5m, 25m, 900k. No currency symbol — the board
 *  carries only the amount, and the written fee is in the clue. */
internal fun money(value: Double): String {
    fun trim(v: Double, suffix: String): String =
        if (v == Math.floor(v)) "${v.toInt()}$suffix" else String.format("%.1f%s", v, suffix)
    return when {
        value >= 1_000_000 -> trim(value / 1_000_000, "m")
        value >= 1_000 -> trim(value / 1_000, "k")
        else -> value.toInt().toString()
    }
}

