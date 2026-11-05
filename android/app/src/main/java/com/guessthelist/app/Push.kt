package com.guessthelist.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

/**
 * Notifications, from the phone's side. The mirror of iOS's PushStore.swift,
 * and of services/push.ts on the server.
 *
 * Registration is tied to having a seat on purpose. The people being notified
 * have no accounts — joining with a code and a typed name is the point — so "a
 * game you are in right now" is the only proof of invitation the app can
 * offer, and the server asks for exactly that on a first registration.
 *
 * Everything here tolerates Firebase being absent. Without a
 * google-services.json the build still works and the app still runs; it simply
 * never obtains a token, so no notification is ever sent to it. That is the
 * same bargain livekit.ts strikes on the server, and it means a missing
 * Firebase project is a quiet gap rather than a crash on launch.
 */
object Push {
    /** The channel Android groups these under, matched in pushFcm.ts. */
    const val CHANNEL_ID = "games"

    /** What a notification's payload calls the room code. */
    const val CODE_KEY = "code"

    private const val PREFS = "gtl.push"
    private const val KEY_SECRET = "secret"
    private const val KEY_TOKEN = "token"
    private const val KEY_NAME = "name"
    private const val KEY_MUTED = "muted"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun secret(context: Context): String? = prefs(context).getString(KEY_SECRET, null)

    fun token(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun muted(context: Context): Boolean = prefs(context).getBoolean(KEY_MUTED, false)

    /**
     * The participant token of a game this phone is sitting in, read straight
     * out of where RoomViewModel keeps it.
     *
     * Read rather than passed in because the token arrives from Firebase on a
     * callback, at a moment that has no view model to hand.
     */
    private fun savedSeatToken(context: Context): String? {
        val raw = context.getSharedPreferences("gtl", Context.MODE_PRIVATE)
            .getString(RoomViewModel.SEAT_KEY, null) ?: return null
        return runCatching { Json.decodeFromString<Seat>(raw).token }.getOrNull()
    }

    fun noteDisplayName(context: Context, name: String) {
        if (name.isBlank() || name == prefs(context).getString(KEY_NAME, null)) return
        prefs(context).edit().putString(KEY_NAME, name).apply()
        sync(context)
    }

    /**
     * Adopt the secret the server handed back on a create or join.
     *
     * That is how a HOST first registers: they hold a user session rather than
     * the participant token [sync] would otherwise need.
     */
    fun adoptSecret(context: Context, secret: String?) {
        if (secret == null || secret == secret(context)) return
        prefs(context).edit().putString(KEY_SECRET, secret).apply()
    }

    /**
     * Ask Firebase for this install's token, then tell the server.
     *
     * Called when the app enters a room, which is both when the token is worth
     * having and when there is a participant token to register it with.
     */
    fun start(context: Context) {
        val messaging = runCatching { FirebaseMessaging.getInstance() }.getOrNull()
        if (messaging == null) {
            // No google-services.json in the build. Expected, and not an error.
            android.util.Log.i("Push", "Firebase not configured; notifications are off")
            return
        }
        messaging.token
            .addOnSuccessListener { received(context, it) }
            .addOnFailureListener { android.util.Log.w("Push", "token request failed", it) }
    }

    /** Firebase has given us a token, either on request or because it rotated. */
    fun received(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
        sync(context)
    }

    /**
     * Tell the server our token, if we are in a position to be believed.
     *
     * Safe to call whenever anything changes: with a secret it is an update,
     * and without one it needs a seat, so it waits for the next time somebody
     * joins a game.
     */
    fun sync(context: Context) {
        val token = token(context) ?: return
        val secret = secret(context)
        val seatToken = if (secret == null) savedSeatToken(context) else null
        if (secret == null && seatToken == null) return
        scope.launch {
            try {
                val result = Api.registerPushDevice(
                    token = token,
                    secret = secret,
                    participantToken = seatToken,
                    displayName = prefs(context).getString(KEY_NAME, null),
                )
                prefs(context).edit()
                    .putString(KEY_SECRET, result.secret)
                    .putBoolean(KEY_MUTED, result.muted)
                    .apply()
            } catch (failure: Api.Failure) {
                // The server has never heard of this secret — a rebuilt or
                // restored database. Drop it and register from scratch the
                // next time there is a seat to prove ourselves with.
                if (failure.status == 404) prefs(context).edit().remove(KEY_SECRET).apply()
                else android.util.Log.w("Push", "register failed: ${failure.message}")
            } catch (err: Exception) {
                android.util.Log.w("Push", "register failed", err)
            }
        }
    }

    suspend fun setMuted(context: Context, muted: Boolean): Boolean {
        val secret = secret(context) ?: return muted(context)
        val result = Api.setPushMuted(secret, muted)
        prefs(context).edit().putBoolean(KEY_MUTED, result).apply()
        return result
    }

    // ── Showing one ─────────────────────────────────────────────────────────

    /**
     * The channel has to exist before the first notification, and creating it
     * twice is a no-op, so this is called from both the service and the
     * activity rather than relying on either having run first.
     */
    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Game invites",
            // HIGH, because this is somebody waiting for you to join. DEFAULT
            // would arrive silently on many phones, which for an invite is the
            // same as not arriving.
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "When someone starts a game you can join" }
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    /**
     * Draw a notification ourselves.
     *
     * Needed because Android only draws an FCM `notification` payload for us
     * while the app is in the BACKGROUND. In the foreground the message
     * arrives at the service instead and nothing is shown — and the foreground
     * case is the one that matters most here: you are sitting in a game that
     * has stopped working, looking at the screen, and somebody has just
     * started a new one for you to come to.
     */
    fun show(context: Context, title: String, body: String, code: String?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        ensureChannel(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (code != null) putExtra(CODE_KEY, code)
        }
        val pending = PendingIntent.getActivity(
            context,
            0,
            intent,
            // MUTABLE is not needed and IMMUTABLE is required from API 31 up.
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            // Ours, not android.R.drawable.ic_dialog_info — which is a stock
            // system glyph and was only ever a placeholder. See
            // res/drawable/ic_notification.xml for why it is a separate file
            // from the launcher's themed layer.
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .build()

        // A fixed id, so a newer invite REPLACES the last one rather than
        // stacking beneath it. Two live invites on a lock screen is a way to
        // send somebody to the wrong game.
        runCatching { NotificationManagerCompat.from(context).notify(1, notification) }
    }
}
