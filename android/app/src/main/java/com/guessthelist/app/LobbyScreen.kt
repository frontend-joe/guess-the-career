package com.guessthelist.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

// Hosting needs an account; joining needs a name and nothing else. That
// asymmetry is the product — asking the friend you are already on a call with
// to sign up is how you end up playing on your own.
@Composable
fun LobbyScreen(model: RoomViewModel, invite: MutableState<String?> = remember { mutableStateOf(null) }) {
    var code by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    // The host's name, and the one the server last confirmed. Two of them so
    // that saving can be skipped when nothing was typed. A signed-in host had
    // no way to change this at all — the name on their tile was whatever
    // their email started with, which for the only account that exists is
    // "admin".
    var hostName by remember { mutableStateOf("") }
    var savedHostName by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val context = LocalContext.current

    fun run(body: suspend () -> Unit) {
        // Every button on this screen commits something, and a commit puts the
        // keyboard away — before the work, so the field is no longer focused
        // by the time signing in or creating a room recomposes around it.
        focus.clearFocus()
        busy = true
        model.error = null
        scope.launch {
            try { body() } catch (e: Exception) { model.error = e.message }
            busy = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            // Android 15 draws edge to edge by default, so without this the
            // title sits under the status bar.
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // An invite link fills the code in and leaves the guest with only the
        // one thing they actually have to supply: their name.
        LaunchedEffect(invite.value) {
            // Whatever went wrong with the last room is not news about this
            // link, so a fresh invite clears the slate it lands on.
            invite.value?.let { code = it; invite.value = null; model.error = null }
        }

        // Whatever the server currently calls this host. Failure is silent on
        // purpose: not knowing the name yet is no reason to put a red line
        // across the lobby, and typing one in is the fix for both cases.
        LaunchedEffect(model.accessToken) {
            val token = model.accessToken ?: return@LaunchedEffect
            runCatching { Api.account(token).displayName }.getOrNull()?.let {
                hostName = it
                savedHostName = it
            }
        }

        Text("Football Tenable", style = MaterialTheme.typography.headlineMedium)

        Text("Join a game", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase() },
            label = { Text("Code") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Your name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                run {
                    val name = displayName.trim()
                    val joined = Api.joinRoom(code.trim(), name, Push.token(context))
                    Push.adoptSecret(context, joined.deviceSecret)
                    Push.noteDisplayName(context, name)
                    model.enter(joined)
                }
            },
            enabled = !busy && code.isNotBlank() && displayName.isNotBlank(),
        ) { Text("Join") }

        Text("Host a game", style = MaterialTheme.typography.titleMedium)
        if (model.accessToken == null) {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    run {
                        model.accessToken = Api.signIn(email.trim(), password).accessToken
                        password = ""
                    }
                },
                enabled = !busy && email.isNotBlank() && password.isNotEmpty(),
            ) { Text("Sign in") }
        } else {
            // Editable, and saved on the way into the room rather than behind
            // a Save button: the only moment anybody cares what their name is,
            // is the moment before everybody else can see it.
            OutlinedTextField(
                value = hostName,
                onValueChange = { hostName = it },
                label = { Text("Your name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    run {
                        val token = model.accessToken!!
                        // Before the room, not after: createRoom snapshots the
                        // name onto the participant row, and a rename landing
                        // a moment later would leave the host sitting under
                        // the old one for the whole game.
                        val name = hostName.trim()
                        if (name.isNotEmpty() && name != savedHostName) {
                            Api.setDisplayName(name, token)
                            savedHostName = name
                            // So the push registry can say which phone this
                            // is, the same as the guest path does on join.
                            Push.noteDisplayName(context, name)
                        }
                        // The push token goes out WITH the create, so the
                        // server knows which phone the host is on before it
                        // sends the invite that must skip it.
                        val joined = Api.createRoom(token, Push.token(context))
                        Push.adoptSecret(context, joined.deviceSecret)
                        model.enter(joined)
                    }
                },
                enabled = !busy && hostName.isNotBlank(),
            ) { Text("Create a room") }
        }

        model.error?.let { Text(it, color = Color(0xFFFF6B6B)) }
    }
}
