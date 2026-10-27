package com.guessthelist.app

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.AlertDialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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
        Modifier.fillMaxSize().padding(horizontal = 10.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        for (rank in 1..round.board.target) {
            val hasClue = round.board.hints.any { it.rank == rank }
            val answered = round.board.revealed.any { it.rank == rank }
            PyramidRow(
                rank = rank,
                answer = round.board.revealed.firstOrNull { it.rank == rank },
                hasClue = hasClue,
                canHint = model.isHost && round.isLive,
                onLongPress = {
                    // Taking a clue is the host's, while the round is live.
                    // READING one already taken is everybody's, and stays
                    // available after the round ends.
                    when {
                        hasClue -> showingClue = rank
                        model.isHost && round.isLive && !answered -> {
                            model.takeHint(rank)
                            showingClue = rank
                        }
                    }
                },
                modifier = Modifier.weight(1f).fillMaxWidth(widthFraction(rank)),
            )
        }
    }

    showingClue?.let { rank ->
        ClueDialog(
            rank = rank,
            hint = round.board.hints.firstOrNull { it.rank == rank },
            impliedClues = round.board.impliedClues,
            onDismiss = { showingClue = null },
        )
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
    onDismiss: () -> Unit,
) {
    val fields = listOf(
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
            if (rows.isEmpty()) {
                Text("Nothing to give away — everything known about this one is already in the question.")
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    rows.forEach { (label, value) ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(label, color = Color.Gray, fontSize = 14.sp)
                            Text(value, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PyramidRow(
    rank: Int,
    answer: RevealedAnswer?,
    /** Whether a clue has been taken. The clue itself lives in the dialog. */
    hasClue: Boolean,
    canHint: Boolean,
    onLongPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val brush = when {
        answer == null -> Brush.verticalGradient(listOf(VioletTop, VioletBottom))
        answer.missed -> Brush.verticalGradient(listOf(MissedTop, MissedBottom))
        else -> Brush.verticalGradient(listOf(GreenTop, GreenBottom))
    }

    val interaction = remember { MutableInteractionSource() }
    val holding by interaction.collectIsPressedAsState()
    val holdable = answer == null && (canHint || hasClue)
    // Feedback on press-down, not on release: a row you are holding for a clue
    // has to acknowledge the hold while it is happening, or the second before
    // the clue appears feels like nothing is working. Critically damped —
    // nothing was thrown, so nothing should bounce.
    val scale by animateFloatAsState(
        targetValue = if (holding && holdable) 0.97f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "press",
    )
    val haptics = LocalHapticFeedback.current

    Box(
        modifier = modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(CircleShape)
            .background(brush)
            // Press and hold a blank slot for a clue, exactly as on the web.
            .combinedClickable(
                interactionSource = interaction,
                indication = null,
                onLongClick = {
                    if (holdable) {
                        // Causality: fired on the event that opens the clue,
                        // not on the touch that requested it.
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onLongPress()
                    }
                },
                onClick = {},
            ),
        contentAlignment = Alignment.Center,
    ) {
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
                Box(
                    Modifier
                        .sizeIn(minWidth = 24.dp, minHeight = 22.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.35f))
                        .padding(horizontal = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        valueText(answer),
                        fontSize = 11.sp,
                        fontFamily = AppFonts.Display,
                        color = Color.White,
                    )
                }
            }
            // The rank stays put whether or not a clue has been taken — the
            // pyramid keeps its shape — and a dot says there is one to read.
            // Press and hold again to reopen it.
            else -> Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    "$rank",
                    fontSize = 17.sp,
                    fontFamily = AppFonts.Display,
                    color = Color.White.copy(alpha = 0.95f),
                )
                if (hasClue) {
                    Icon(
                        Icons.Filled.Lightbulb,
                        contentDescription = "Clue taken",
                        tint = Color(0xFFFACC15),
                        modifier = Modifier.size(13.dp),
                    )
                }
            }
        }
    }
}

private fun valueText(answer: RevealedAnswer): String {
    val number = answer.value.toInt().toString()
    val unit = answer.unit
    return if (unit.isNullOrEmpty()) number else "$number $unit"
}

