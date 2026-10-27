package com.guessthelist.app

import android.Manifest
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {

    // Asked up front and answered before anything touches the camera. iOS
    // taught this the hard way: enabling a track before the prompt is answered
    // fails on a first run and then looks fine for ever after, because the
    // second run is already granted.
    private val permissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    // A code pulled out of an invite link and not yet used. The lobby reads
    // it, so a link lands you on "type your name" rather than joining under
    // whatever name happened to be in the field.
    private val pendingInvite = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge to edge, so the IME inset is actually reported to Compose
        // rather than being consumed by the decor view. safeDrawingPadding on
        // the root includes that inset, which is what makes the layout
        // compress as the keyboard comes up instead of hiding behind it.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        permissions.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        pendingInvite.value = inviteCode(intent)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) { Root(pendingInvite) }
            }
        }
    }

    // A link tapped while the app is already open arrives here instead, and
    // the activity keeps serving its original intent unless told otherwise.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        inviteCode(intent)?.let { pendingInvite.value = it }
    }

    /// https://guessthelist.xyz/join/<CODE>. Anything else is ignored rather
    /// than guessed at.
    private fun inviteCode(intent: Intent?): String? {
        val segments = intent?.data?.pathSegments ?: return null
        if (segments.size < 2 || segments[0] != "join") return null
        return segments[1].uppercase().filter { it.isLetterOrDigit() }.ifEmpty { null }
    }
}

@Composable
private fun Root(invite: MutableState<String?>, model: RoomViewModel = viewModel()) {
    if (model.inRoom) RoomScreen(model) else LobbyScreen(model, invite)
}
