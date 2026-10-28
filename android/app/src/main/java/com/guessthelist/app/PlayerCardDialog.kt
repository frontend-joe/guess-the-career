package com.guessthelist.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

// The player card, opened by tapping a row you have already found.
//
// A port of client/src/components/PlayerInfoModal.tsx and a mirror of iOS's
// PlayerCardSheet, with one deliberate omission: the web modal draws a club
// crest beside every stint, resolved by a Wikipedia lookup per club from the
// browser. That is a round trip a row and a second image pipeline, for a 16dp
// badge, on a screen already carrying four video tracks. The names and the
// numbers are the content.
//
// Light, not dark, exactly as on the web. The card is a reference sheet lifted
// over the game; a dark one would read as another part of the board.
private val Ink = Color(0xFF1F2937)
private val InkSoft = Color(0xFF6B7280)
private val InkFaint = Color(0xFF9CA3AF)
private val Hairline = Color(0xFFF0F0F2)
private val Band = Color(0xFFF3F4F6)

@Composable
fun PlayerCardDialog(
    /** Null when the board has a name but no footballer behind it. The dialog
     *  still opens and says so, rather than the row ignoring the tap. */
    footballerId: Int?,
    /** Shown while the card loads, so the dialog opens with the name on it
     *  rather than a title that arrives half a second later. */
    name: String,
    onDismiss: () -> Unit,
) {
    var card by remember(footballerId) { mutableStateOf<FootballerCard?>(null) }
    var failed by remember(footballerId) { mutableStateOf(false) }

    LaunchedEffect(footballerId) {
        if (footballerId == null) return@LaunchedEffect
        runCatching { Api.footballerCard(footballerId) }
            .onSuccess { card = it }
            .onFailure { failed = true }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(color = Color.White, shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 14.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        card?.name ?: name,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onDismiss) { Text("Close") }
                }

                when {
                    card != null -> card?.let { loaded ->
                        BioRow("Full name", loaded.fullName)
                        BioRow("Date of birth", bornLong(loaded.born))
                        BioRow("Birth place", loaded.birthplace)
                        BioRow("Nationality", loaded.nationality)
                        BioRow("Position", loaded.position)
                        BioRow("Height", heightText(loaded.heightCm))
                        Career("Senior career", loaded.senior)
                        Career("International career", loaded.international, international = true)
                    }
                    // Either this answer has no footballer record at all, or
                    // the round predates the board logging who its rows are.
                    footballerId == null -> Message("No career on file for this one.")
                    failed -> Message("Couldn't load this player.")
                    else -> Box(Modifier.fillMaxWidth().padding(vertical = 48.dp), Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            }
        }
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 48.dp), Alignment.Center) {
        Text(text, color = InkSoft, fontSize = 13.sp)
    }
}

@Composable
private fun BioRow(label: String, value: String?) {
    if (value.isNullOrEmpty()) return
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InkSoft, modifier = Modifier.width(104.dp))
        Text(value, fontSize = 13.sp, color = Ink, modifier = Modifier.weight(1f))
    }
    HorizontalDivider(color = Hairline)
}

@Composable
private fun Career(title: String, stints: List<CardStint>, international: Boolean = false) {
    if (stints.isEmpty()) return
    HorizontalDivider(color = Color(0xFFE5E7EB))
    Text(
        title,
        fontSize = 13.sp,
        fontFamily = AppFonts.Display,
        color = Color(0xFF4B5563),
        modifier = Modifier.fillMaxWidth().background(Band).padding(horizontal = 14.dp, vertical = 7.dp),
    )
    HorizontalDivider(color = Color(0xFFE5E7EB))
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Years", fontSize = 11.sp, color = InkFaint, modifier = Modifier.width(66.dp))
        Text("Team", fontSize = 11.sp, color = InkFaint, modifier = Modifier.weight(1f))
        Text(
            if (international) "Caps (Gls)" else "Apps (Gls)",
            fontSize = 11.sp, color = InkFaint, modifier = Modifier.width(74.dp),
        )
    }
    stints.forEach { stint ->
        HorizontalDivider(color = Hairline)
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(stint.years, fontSize = 12.sp, color = InkSoft, modifier = Modifier.width(66.dp))
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                // The arrow is how Wikipedia says "out on loan", and it is
                // worth keeping: a row of 6 appearances reads very differently
                // once you can see it was a loan spell.
                if (stint.tag == "loan") Text("→", fontSize = 12.sp, color = InkFaint)
                Text(
                    stint.tag?.let { "${stint.clubName} ($it)" } ?: stint.clubName,
                    fontSize = 12.sp,
                    color = Ink,
                )
            }
            Text(stint.appsGoals, fontSize = 12.sp, color = InkSoft, modifier = Modifier.width(74.dp))
        }
    }
}

/** "26 June 1991" — the long form the web modal shows, not the stored ISO date. */
private fun bornLong(born: String?): String? {
    if (born.isNullOrEmpty()) return null
    val date = runCatching { LocalDate.parse(born.take(10)) }.getOrNull() ?: return born
    return date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK))
}

/** "1.78 m (5 ft 10 in)", as the web modal writes it. */
private fun heightText(cm: Int?): String? {
    if (cm == null || cm <= 0) return null
    val inches = (cm / 2.54).roundToInt()
    return String.format(Locale.UK, "%.2f m (%d ft %d in)", cm / 100.0, inches / 12, inches % 12)
}
