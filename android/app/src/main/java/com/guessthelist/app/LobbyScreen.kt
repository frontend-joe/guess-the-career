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
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

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
            onClick = { run { model.enter(Api.joinRoom(code.trim(), displayName.trim())) } },
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
            Button(
                onClick = { run { model.enter(Api.createRoom(model.accessToken!!)) } },
                enabled = !busy,
            ) { Text("Create a room") }
        }

        model.error?.let { Text(it, color = Color(0xFFFF6B6B)) }
    }
}
