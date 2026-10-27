package com.guessthelist.app

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

// The web game's faces, bundled so the apps read as the same product:
// Russo One for the board and anything display-sized (client/src/index.css
// calls it .font-display), Noto Sans for everything you read as text.
//
// res/font file names must be lowercase with underscores — Android's resource
// system rejects anything else — which is why these do not match the .ttf
// names on iOS.
object AppFonts {
    /** Russo One, the board face. The web game's .font-display. */
    val Display = FontFamily(Font(R.font.russo_one_regular))

    /** Noto Sans, the reading face. */
    val Body = FontFamily(
        Font(R.font.noto_sans_regular, FontWeight.Normal),
        Font(R.font.noto_sans_semibold, FontWeight.SemiBold),
        Font(R.font.noto_sans_bold, FontWeight.Bold),
    )
}
