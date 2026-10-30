package com.guessthelist.app

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.border
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Icon
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import io.livekit.android.compose.ui.VideoTrackView
import io.livekit.android.room.participant.LocalParticipant
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoTrack
import kotlinx.coroutines.launch
import kotlin.math.ceil

// The podcast composition, live: board over the top two thirds, faces across
// the bottom third. Playing layout and recorded layout stay the same, so the
// shape of the video is tested every time anyone plays rather than discovered
// when the compositor is written.
@Composable
fun RoomScreen(model: RoomViewModel) {
    // The call carries on off screen — see CallService — but the camera
    // cannot, so it is put away and found again rather than left publishing
    // frames the system stopped delivering.
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { model.onEnterBackground() }
    LifecycleEventEffect(Lifecycle.Event.ON_START) { model.onEnterForeground() }

    var guess by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    var confirmingGiveUp by remember { mutableStateOf(false) }
    var showingActions by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Slide the whole room up by exactly the keyboard's height, keeping every
    // part of it the size and shape it already was. Compose animates this inset
    // in step with the IME, so the movement rides the keyboard's own animation
    // rather than chasing it. systemBars rather than safeDrawing deliberately:
    // safeDrawing includes the IME, which would pad and offset for the same
    // keyboard twice.
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .offset { IntOffset(0, -imeBottom) }
            .background(Color(0xFF0A0A0C))
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {

        // Nothing but the occasional video note now that the code has gone, so
        // it takes no space at all unless it has something to say. An empty
        // bar across the top was costing the board a row of its own height.
        model.videoNote?.let {
            Text(
                it,
                fontSize = 11.sp,
                color = Color(0xFFFBBF24),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp),
            )
        }

        // The question, where the web game puts it: across the top, above the
        // board, so it is readable without looking past the pyramid.

        Box(modifier = Modifier.weight(2f).fillMaxWidth()) {
            BoardSection(model)

        }

        // Under the board, not over it: the question is what the board is an
        // answer to, and reading downwards from the pyramid to the words puts
        // them in that order.
        // Later siblings draw over earlier ones, so the zIndex keeps a toast
        // taller than the band from being clipped by the faces below it.
        Box(Modifier.fillMaxWidth().zIndex(1f)) {
        model.round?.let { round ->
            Text(
                round.board.title,
                fontSize = 15.sp,
                fontFamily = AppFonts.Display,
                color = Color.White,
                textAlign = TextAlign.Center,
                // Its own band, a shade up from the app's background. The
                // question is not part of the board and not part of the
                // faces; giving it a surface of its own says which is which
                // without drawing a line between them.
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF191C23))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            )
        }

            // The near miss lands ON the question, which is the line everyone
            // is already looking at between guesses — and it covers the one
            // thing it is safe to cover for three seconds.
            GuessToastView(model.guessToast, Modifier.align(Alignment.Center))
        }

        // Choosing, starting and ending a round are the host's calls.
        // Guessing is not — the bar below is everyone's.
        // Only what you need BEFORE a round: pick one, start it. It goes away
        // once the round is live, because by then there is nothing left to set
        // up — everything you can still do lives in the one row at the bottom.
        if (model.isHost && model.round?.isLive != true) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(onClick = { picking = true }) { Text("Choose round") }
                Button(
                    onClick = { model.startRound() },
                    enabled = model.pendingInstanceId != null,
                ) { Text("Start") }
                Box(Modifier.weight(1f))
            }
        }


        // Faces and chat share the bottom third rather than splitting it:
        // chat is there for the player whose camera or microphone has failed,
        // which is precisely when their tile is worth nothing anyway.
        // Faces only, for now. The Video/Chat tabs are off while the call is
        // the thing being tested — chat was built for the player whose camera
        // or microphone has failed, and a tab bar costs the faces vertical
        // space in every game where nothing has failed. ChatPanel and its
        // endpoint are untouched, so this is one line away from coming back.
        Box(modifier = Modifier.weight(1f).fillMaxWidth().background(Color(0xFF0A0C10))) {
            VideoGrid(model)
        }

        // Under the faces, because that is the order of the recording: board,
        // then who is playing, then what they said. It costs the board 50dp
        // and earns the only record of the wrong answers anybody will see.
        GuessFeed(model)

        // Errors only. A verdict used to live here too, which meant a line of
        // text saying "hit" sat above a board that had just turned a row
        // green — the same news, twice, in the worse place.
        model.error?.let {
            Text(
                it,
                fontSize = 11.sp,
                color = Color(0xFFFF6B6B),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            )
        }

        // "Count it anyway" — the host overruling the list on a borderline
        // answer. Some rounds are judgement, not fact: there is no authority on
        // the excuses for being late to work, so the list is a dozen good ones
        // and the host decides the rest. It sits above the controls rather than
        // in the toast, because the toast goes away on its own and this is a
        // decision somebody has to make.
        model.rejectedGuess?.takeIf { model.round?.isLive == true }?.let { rejected ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White.copy(alpha = 0.08f))
                    .padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "\u201C$rejected\u201D",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { model.allowRejectedGuess() }) {
                    Text("Count it", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4ADE80))
                }
                IconButton(onClick = { model.dismissRejectedGuess() }) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = "Leave it off the board",
                        tint = Color.White.copy(alpha = 0.6f),
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // The same two icons iOS shows, and the same colour discipline:
            // red means either "this is off" or "this ends something", and
            // everything else is plain white. The row used to carry red, red,
            // grey, red and blue at once, which gave the eye no hierarchy.
            IconButton(
                onClick = { scope.launch { model.setMicrophone(!model.micOn) } },
                enabled = !model.micBusy,
                modifier = Modifier.size(42.dp),
            ) {
                // The tap has to land on the button straight away. What follows
                // it — a reconnect, a publish — takes long enough that an
                // unchanged icon reads as a button that did nothing, which is
                // what made these two feel sticky and invited the second and
                // third tap.
                if (model.micBusy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White,
                    )
                } else {
                    Icon(
                        if (model.micOn) Icons.Filled.Mic else Icons.Filled.MicOff,
                        contentDescription = if (model.micOn) "Mute" else "Unmute",
                        tint = if (model.micOn) Color.White else Color(0xFFFF6B6B),
                    )
                }
            }
            IconButton(
                onClick = { scope.launch { model.setCamera(!model.cameraOn) } },
                enabled = !model.cameraBusy,
                modifier = Modifier.size(42.dp),
            ) {
                if (model.cameraBusy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White,
                    )
                } else {
                    Icon(
                        if (model.cameraOn) Icons.Filled.Videocam else Icons.Filled.VideocamOff,
                        contentDescription = if (model.cameraOn) "Turn camera off" else "Turn camera on",
                        tint = if (model.cameraOn) Color.White else Color(0xFFFF6B6B),
                    )
                }
            }
            // Everyone types, and the field takes the space the controls do
            // not — instead of sitting on a row of its own under an
            // almost-empty one.
            val live = model.round?.isLive == true
            val canSend = live && guess.isNotBlank()
            Row(
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .clip(RoundedCornerShape(21.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    // Swipe down on the field to put the keyboard away.
                    .pointerInput(Unit) {
                        detectVerticalDragGestures { _, dragAmount ->
                            if (dragAmount > 6f) keyboard?.hide()
                        }
                    },
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BasicTextField(
                    value = guess,
                    onValueChange = { guess = it },
                    enabled = live,
                    singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
                    cursorBrush = SolidColor(Color.White),
                    modifier = Modifier.weight(1f).padding(start = 14.dp),
                    decorationBox = { inner ->
                        if (guess.isEmpty()) {
                            Text("Your guess…", color = Color.Gray, fontSize = 15.sp)
                        }
                        inner()
                    },
                )
                IconButton(
                    onClick = { val raw = guess.trim(); if (raw.isNotEmpty()) { model.guess(raw); guess = "" } },
                    enabled = canSend,
                    modifier = Modifier
                        .padding(end = 5.dp)
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(if (canSend) Color.White else Color.White.copy(alpha = 0.12f)),
                ) {
                    Icon(
                        Icons.Filled.ArrowUpward,
                        contentDescription = "Submit guess",
                        tint = if (canSend) Color.Black else Color.White.copy(alpha = 0.35f),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }

            // Everything else is behind one button. Mute and camera are the
            // two you reach for mid-sentence and they stay out here; the rest
            // are things you do once a game, and four labelled buttons
            // competing for a phone's width meant every one of them was
            // cramped.
            Box {
                IconButton(
                    onClick = { showingActions = true },
                    modifier = Modifier.size(42.dp),
                ) {
                    Icon(
                        Icons.Filled.MoreVert,
                        contentDescription = "More options",
                        tint = Color.White,
                    )
                }
                DropdownMenu(
                    expanded = showingActions,
                    onDismissRequest = { showingActions = false },
                    containerColor = Color(0xFF2C2C2E),
                ) {
                    if (model.isHost && model.round?.isLive == true) {
                        ActionRow(Icons.Filled.Flag, "Give up") {
                            confirmingGiveUp = true; showingActions = false
                        }
                    }
                    if (model.isHost) {
                        ActionRow(Icons.Filled.Share, "Share invite") {
                            shareInvite(context, model.state?.code); showingActions = false
                        }
                    }
                    ActionRow(Icons.AutoMirrored.Filled.Logout, "Leave") {
                        model.leave(); showingActions = false
                    }
                    if (model.isHost) {
                        // Destructive, and last: it closes the room for
                        // everybody, not just whoever tapped it.
                        ActionRow(Icons.Filled.Cancel, "End game", tint = Color(0xFFFF6B6B)) {
                            model.endGame(); showingActions = false
                        }
                    }
                }
            }
        }

    }

    if (picking) {
        RoundPickerDialog(
            onDismiss = { picking = false },
            onPick = { model.freezeRound(it); picking = false },
        )
    }
}

@Composable
private fun VideoGrid(model: RoomViewModel) {
    if (model.tiles.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(model.videoNote ?: "connecting…", color = Color.DarkGray, fontSize = 12.sp)
        }
        return
    }
    // Rooms have no seat limit, so the grid wraps: at most four to a row, then
    // as many rows as it takes, every tile the same size. Derived from the
    // count rather than flowed by available width, because the compositor will
    // lay the recording out from the same rule and the two must not be able to
    // disagree. Up to four it is still a single row, so the games everybody
    // has played so far look exactly as they did.
    val rows = ceil(model.tiles.size / 4.0).toInt().coerceAtLeast(1)
    val columns = ceil(model.tiles.size / rows.toDouble()).toInt().coerceAtLeast(1)
    // No spacing: the faces meet each other and the edges of the screen, so
    // the bottom third reads as one band of video rather than a tray of cards.
    Column(Modifier.fillMaxSize()) {
        model.tiles.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth().weight(1f)) {
                row.forEach { tile ->
                    Box(Modifier.weight(1f).fillMaxHeight()) { Tile(model, tile) }
                }
                // A short last row keeps its tiles the size of all the others
                // rather than stretching them to fill the width.
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// One face, and everything you can do about it.
//
// A long press rather than a visible button on every tile: faces in the bottom
// third have no room for chrome, and the more of them there are the less room
// there is. A long press is what Android already uses for "what can I do with
// this thing".
// combinedClickable is still marked experimental; it is the only way to get a
// long press on a Box without hand-rolling gesture detection.
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Tile(model: RoomViewModel, tile: RoomViewModel.Tile) {
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var reporting by remember { mutableStateOf(false) }
    var confirmingRemove by remember { mutableStateOf(false) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xFF16161A))
            .combinedClickable(onClick = {}, onLongClick = { if (!tile.isLocal) menu = true }),
        contentAlignment = Alignment.Center,
    ) {
        val track = tile.track
        val lkRoom = model.room
        when {
            // Not a black rectangle with no explanation: blocking is something
            // you did, and the tile says so and how to undo it.
            tile.isBlocked -> Text("blocked — long press to undo", fontSize = 11.sp, color = Color.Gray)
            track != null && lkRoom != null ->
                // Positional: the published parameter names are not
                // what they look like from the Java signature.
                VideoTrackView(
                    track,
                    Modifier.fillMaxSize(),
                    lkRoom,
                    tile.isLocal,
                )
            else -> Text("camera off", fontSize = 11.sp, color = Color.Gray)
        }

        Text(
            if (tile.isLocal) "${tile.name} (you)" else tile.name,
            fontSize = 10.sp,
            color = Color.White,
            modifier = Modifier.align(Alignment.BottomStart).padding(4.dp),
        )

        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(
                text = { Text(if (tile.isBlocked) "Unblock ${tile.name}" else "Block ${tile.name}") },
                leadingIcon = {
                    Icon(
                        if (tile.isBlocked) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                        contentDescription = null,
                    )
                },
                onClick = { menu = false; scope.launch { model.toggleBlock(tile) } },
            )
            DropdownMenuItem(
                text = { Text("Report ${tile.name}") },
                leadingIcon = { Icon(Icons.Filled.Flag, contentDescription = null) },
                onClick = { menu = false; reporting = true },
            )
            // Removing is the host's, and it is destructive, so it is last and
            // it asks first.
            if (model.isHost) {
                DropdownMenuItem(
                    text = { Text("Remove from game", color = Color(0xFFFF6B6B)) },
                    leadingIcon = {
                        Icon(Icons.Filled.PersonRemove, contentDescription = null, tint = Color(0xFFFF6B6B))
                    },
                    onClick = { menu = false; confirmingRemove = true },
                )
            }
        }
    }

    if (reporting) {
        val reasons = listOf(
            "abuse" to "Abusive behaviour",
            "harassment" to "Harassment",
            "nudity" to "Nudity or sexual content",
            "hate" to "Hate speech",
            "other" to "Something else",
        )
        AlertDialog(
            onDismissRequest = { reporting = false },
            title = { Text("Report ${tile.name}") },
            confirmButton = { TextButton(onClick = { reporting = false }) { Text("Cancel") } },
            text = {
                Column {
                    reasons.forEach { (code, label) ->
                        TextButton(onClick = {
                            reporting = false
                            scope.launch { model.report(tile, code) }
                        }) { Text(label) }
                    }
                }
            },
        )
    }

    if (confirmingRemove) {
        AlertDialog(
            onDismissRequest = { confirmingRemove = false },
            title = { Text("Remove ${tile.name} from the game?") },
            text = { Text("They lose their place and their invite stops working.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmingRemove = false
                    scope.launch { model.removePlayer(tile) }
                }) { Text("Remove", color = Color(0xFFFF6B6B)) }
            },
            dismissButton = { TextButton(onClick = { confirmingRemove = false }) { Text("Cancel") } },
        )
    }
}

// Every guess as it lands, in a band of its own under the faces.
//
// The board says what was RIGHT. It cannot say who said it, and it says
// nothing at all about the nineteen wrong answers that got you there — which
// is most of what actually happens in a round, and most of what is worth
// hearing back on the recording. So the names live here instead: a shallow
// strip of the last few guesses, newest nearest the edge you read from.
//
// 50dp, fixed. One row of pills rather than a scrolling list on purpose: a
// band this short can show one line well or two badly, and the thing being
// watched is the newest guess arriving, not the history.
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GuessFeed(model: RoomViewModel) {
    // More than the eye can follow anyway; the point of the tail is that a
    // guess you glanced away from has not gone.
    val window = 12
    val guesses = model.round?.board?.guesses ?: emptyList()
    // The log is append-only, so an index is a stable identity — which is what
    // lets a new guess animate in rather than the whole row redrawing.
    // Not named `items`: that is also the LazyRow builder's own name, and the
    // call below resolves to the wrong one.
    // withIndex is lazy and gives an Iterable, which has no takeLast — hence
    // the toList before it.
    val feed = guesses
        .withIndex()
        .toList()
        .takeLast(window)
        .reversed()

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .background(Color(0xFF0A0A0C)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        contentPadding = PaddingValues(horizontal = 14.dp),
    ) {
        items(feed.size, key = { feed[it].index }) { i ->
            val guess = feed[i].value
            // Fired from the item's own first composition, so it is the
            // arrival that animates. A resync that re-sends the same log
            // re-uses the same keys and nothing replays.
            var shown by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) { shown = true }
            AnimatedVisibility(
                visible = shown,
                enter = fadeIn() + scaleIn(initialScale = 0.7f),
                exit = fadeOut(),
                modifier = Modifier.animateItem(),
            ) {
                GuessPill(model, guess)
            }
        }
    }
}

// Name first, then what they said. That order because the name is what the
// board cannot tell you, and because a column of names down the leading edge
// is scannable in a way a column of guesses is not.
@Composable
private fun GuessPill(model: RoomViewModel, guess: ReplayGuess) {
    val colour = verdictColour(guess.verdict)
    val name = model.displayNameOfParticipant(guess.byParticipantId)

    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(CircleShape)
            // Tinted by the verdict rather than coloured by it: twelve filled
            // pills in four colours is a bag of sweets, and the board is
            // already where colour means something.
            .background(colour.copy(alpha = 0.16f))
            .border(1.dp, colour.copy(alpha = 0.35f), CircleShape)
            .padding(horizontal = 11.dp, vertical = 7.dp),
    ) {
        if (name != null) {
            Text(name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = colour, maxLines = 1)
        }
        Text(
            guess.raw,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = Color.White.copy(alpha = 0.92f),
            maxLines = 1,
        )
    }
}

private fun verdictColour(verdict: String): Color = when (verdict) {
    "hit" -> Color(0xFF4ADE80)
    "near" -> Color(0xFFFBBF24)
    "duplicate" -> Color(0xFF60A5FA)
    else -> Color(0xFFFF6B6B)
}

// A couple of thousand football rounds, so this is a filter box over a list —
// plus a category to filter within, because Tenable is more than one game now
// and the geography rounds are not findable by typing a club name.
@Composable
private fun RoundPickerDialog(onDismiss: () -> Unit, onPick: (Int) -> Unit) {
    var categories by remember { mutableStateOf<List<TenableCategory>>(emptyList()) }
    var category by remember { mutableStateOf("football") }
    var rounds by remember { mutableStateOf<List<PoolRound>>(emptyList()) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        categories = runCatching { Api.tenableCategories() }.getOrDefault(emptyList())
    }
    LaunchedEffect(category) {
        query = ""
        rounds = runCatching { Api.roundPool(category) }.getOrDefault(emptyList())
    }

    val matches = remember(query, rounds) {
        val q = query.trim().lowercase()
        (if (q.isEmpty()) rounds
         else rounds.filter { "${it.date ?: ""} ${it.title}".lowercase().contains(q) })
            .take(200)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose a round") },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        text = {
            Column {
                // Only worth drawing once there is a choice to make.
                if (categories.size > 1) {
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                        categories.forEachIndexed { i, cat ->
                            SegmentedButton(
                                selected = category == cat.slug,
                                onClick = { category = cat.slug },
                                shape = SegmentedButtonDefaults.itemShape(i, categories.size),
                            ) { Text(cat.label, fontSize = 13.sp) }
                        }
                    }
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Filter rounds") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (matches.isEmpty()) {
                    Text(
                        "No rounds in this category yet.",
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 16.dp),
                    )
                } else {
                    LazyColumn(Modifier.fillMaxHeight(0.7f)) {
                        items(matches) { round ->
                            TextButton(onClick = { onPick(round.roundId) }) {
                                // Only Football's rounds have a date, and only
                                // because they came off its calendar.
                                Text(
                                    round.date?.let { "$it — ${round.title}" } ?: round.title,
                                    fontSize = 13.sp,
                                )
                            }
                        }
                    }
                }
            }
        },
    )
}

@Suppress("unused")   // off while the Video/Chat tabs are hidden
@Composable
private fun ChatPanel(model: RoomViewModel, messages: List<ChatMessage>) {
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    // Follow the conversation, the way every chat does. Keyed on the last id
    // rather than the count, so a resync that replaces the window still
    // scrolls correctly.
    LaunchedEffect(messages.lastOrNull()?.id) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    Column(Modifier.fillMaxSize()) {
        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth().padding(12.dp)) {
                Text(
                    "No messages yet. Type here if your mic or camera isn't working.",
                    fontSize = 12.sp,
                    color = Color.Gray,
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(messages, key = { it.id }) { message ->
                    val mine = message.participantId == model.seat?.participantId
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
                    ) {
                        Text(
                            message.displayName,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray,
                        )
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (mine) Color(0xFF3B2E7A) else Color(0xFF2B2B2F))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(message.body, fontSize = 14.sp, color = Color.White)
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                placeholder = { Text("Message") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = { model.sendChat(draft); draft = "" },
                enabled = draft.isNotBlank(),
            ) { Text("Send") }
        }
    }
}

// Hand the link to whatever the person uses to talk to their mates. A chooser
// rather than a specific app, because that is not ours to decide.
//
// One shape across all three clients — /join/<CODE> — because it is also what
// the website routes and what the two association files claim. A link that
// opens the app on one platform and the website on the other would be the same
// bug twice.
private fun shareInvite(context: Context, code: String?) {
    if (code.isNullOrEmpty()) return
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "Join my Tenable game: https://guessthelist.xyz/join/$code")
    }
    context.startActivity(Intent.createChooser(intent, "Share the invite"))
}


// A menu row with the icon in a fixed leading lane, so every label starts at
// the same x however wide its icon happens to draw.
@Composable
private fun ActionRow(
    icon: ImageVector,
    label: String,
    tint: Color = Color.White,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        leadingIcon = { Icon(icon, contentDescription = null, tint = tint) },
        text = { Text(label, color = tint, fontSize = 16.sp) },
        onClick = onClick,
    )
}


// Its own composable so AnimatedVisibility resolves to the plain overload:
// called inside a Box that sits in a Column, Kotlin picks ColumnScope's and
// refuses the implicit receiver.
//
// A near miss shouts; everything else murmurs. Being close is news, and amber
// against a green-and-violet board with dark text on a filled capsule is
// readable across a room on a video call. Being wrong is just an answer, and a
// quiet slate pill says it without stopping the game.
@Composable
private fun GuessToastView(toast: RoomViewModel.GuessToast?, modifier: Modifier = Modifier) {
    // Remembered so the words do not vanish a frame before the pill does,
    // which turns a fade-out into a flicker of empty capsule.
    var last by remember { mutableStateOf<RoomViewModel.GuessToast?>(null) }
    toast?.let { last = it }
    val shown = last

    AnimatedVisibility(
        visible = toast != null,
        enter = fadeIn() + scaleIn(initialScale = 0.88f),
        exit = fadeOut(),
        modifier = modifier,
    ) {
        val loud = shown?.emphatic == true
        Text(
            shown?.text.orEmpty(),
            fontSize = if (loud) 16.sp else 14.sp,
            fontWeight = if (loud) FontWeight.Bold else FontWeight.SemiBold,
            color = if (loud) Color(0xFF1C1705) else Color.White.copy(alpha = 0.92f),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(horizontal = 16.dp)
                .clip(CircleShape)
                .background(if (loud) Color(0xFFFABF24) else Color(0xFF333945))
                .padding(
                    horizontal = if (loud) 20.dp else 16.dp,
                    vertical = if (loud) 14.dp else 11.dp,
                ),
        )
    }
}
