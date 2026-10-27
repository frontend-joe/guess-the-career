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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
            PyramidRow(
                rank = rank,
                answer = round.board.revealed.firstOrNull { it.rank == rank },
                hint = round.board.hints.firstOrNull { it.rank == rank },
                impliedClues = round.board.impliedClues,
                canHint = model.isHost && round.isLive,
                onHint = { model.takeHint(rank) },
                modifier = Modifier.weight(1f).fillMaxWidth(widthFraction(rank)),
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PyramidRow(
    rank: Int,
    answer: RevealedAnswer?,
    hint: TakenHint?,
    impliedClues: List<String>,
    canHint: Boolean,
    onHint: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val brush = when {
        answer == null -> Brush.verticalGradient(listOf(VioletTop, VioletBottom))
        answer.missed -> Brush.verticalGradient(listOf(MissedTop, MissedBottom))
        else -> Brush.verticalGradient(listOf(GreenTop, GreenBottom))
    }

    val interaction = remember { MutableInteractionSource() }
    val holding by interaction.collectIsPressedAsState()
    val holdable = answer == null && hint == null && canHint
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
                        // Causality: fired on the event that changes the
                        // board, not on the touch that requested it.
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onHint()
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
            // A taken clue replaces the rank number rather than adding a line,
            // so the pyramid keeps its shape.
            hint != null -> Text(
                clueText(hint, impliedClues),
                fontSize = 11.sp,
                fontFamily = AppFonts.Body,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.95f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            else -> Text(
                "$rank",
                fontSize = 17.sp,
                fontFamily = AppFonts.Display,
                color = Color.White.copy(alpha = 0.95f),
            )
        }
    }
}

private fun valueText(answer: RevealedAnswer): String {
    val number = answer.value.toInt().toString()
    val unit = answer.unit
    return if (unit.isNullOrEmpty()) number else "$number $unit"
}

private fun clueText(hint: TakenHint, implied: List<String>): String {
    val fields = listOf(
        "nationality" to "Nationality", "position" to "Position", "years" to "Years",
        "club" to "Club", "squadNumber" to "Shirt", "born" to "Born",
    )
    val parts = fields.mapNotNull { (key, label) ->
        if (implied.contains(key)) null else hint.display(key)?.let { "$label: $it" }
    }
    return if (parts.isEmpty()) "Nothing to give away" else parts.joinToString(" · ")
}
