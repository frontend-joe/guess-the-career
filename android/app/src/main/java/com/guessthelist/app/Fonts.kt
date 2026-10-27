package com.guessthelist.app

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily

// One bundled face: Russo One, for the board and anything display-sized (the
// web game's .font-display). Everything else is the platform's own font —
// Roboto here, San Francisco on iOS.
//
// A downloaded .ttf buys nothing for ordinary text: the system face already
// ships the hinting and legibility tuning, and it honours the reader's text-
// size setting. Russo One earns its place because the board IS the game's
// identity; a settings label is not.
//
// res/font file names must be lowercase with underscores — Android's resource
// system rejects anything else — which is why this does not match the .ttf
// name on iOS.
object AppFonts {
    /** Russo One, the board face. The web game's .font-display. */
    val Display = FontFamily(Font(R.font.russo_one_regular))

    /** Roboto, via the platform default. */
    val Body = FontFamily.Default
}
