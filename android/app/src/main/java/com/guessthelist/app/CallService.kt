package com.guessthelist.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Keeps the microphone alive while the app is not on screen.
 *
 * Since Android 9 a process with no visible activity is handed silence
 * instead of microphone samples. Nothing errors and nothing in the SDK
 * reports it: the track stays published, the other players' tiles still show
 * you unmuted, and you talk to a room that cannot hear you. The one documented
 * exception is a foreground service typed `microphone`, which is all this is.
 *
 * Playback is not restricted the same way, so someone who is muted still hears
 * the room without this running. The service exists for the microphone, and it
 * runs only while the microphone does — a notification parked in the shade for
 * a call nobody is speaking into is a cost with nothing on the other side.
 *
 * The manifest declares `foregroundServiceType="microphone"`, and Android
 * refuses to start such a service — with a SecurityException, not a quiet
 * failure — unless RECORD_AUDIO is already granted. Every caller here goes
 * through [start], which checks.
 */
class CallService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, notification())
        // Not START_STICKY: a service restarted on its own has no room, no
        // seat and no connection, so it would put a notification in the shade
        // for a call that is not happening.
        return START_NOT_STICKY
    }

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "In a game", NotificationManager.IMPORTANCE_LOW)
                    .apply { setShowBadge(false) },
            )
        }
        // Tapping it comes back to the game rather than starting a second
        // copy of it — the activity is already there, behind whatever the
        // person went off to do.
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Tenable")
            .setContentText("You're in a game — your mic is on.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "call"
        private const val NOTIFICATION_ID = 1

        /** Starts the service, or does nothing if the microphone is not ours
         *  to keep alive. Safe to call when it is already running. */
        fun start(context: Context) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
            ContextCompat.startForegroundService(context, Intent(context, CallService::class.java))
        }

        /** Safe to call when it is not running. */
        fun stop(context: Context) {
            context.stopService(Intent(context, CallService::class.java))
        }
    }
}
