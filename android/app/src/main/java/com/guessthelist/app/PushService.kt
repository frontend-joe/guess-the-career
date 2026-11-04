package com.guessthelist.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Where Firebase delivers.
 *
 * Two callbacks matter. [onNewToken] fires when this install's token is issued
 * or reissued, which is the only notice we get — a token changes on a restore
 * or a reinstall and nothing asks us first.
 *
 * [onMessageReceived] fires only while the app is in the FOREGROUND; in the
 * background Android draws the notification payload itself and this is never
 * called. So the foreground case has to draw its own, which is also the case
 * that matters most: you are sitting in a game that has stopped working and
 * somebody has just started a new one for you to come to.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Push.received(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val code = message.data[Push.CODE_KEY]
        // The notification block when there is one, falling back to the data
        // copy. Both are sent (see fcmBody in pushFcm.ts) precisely so this
        // does not depend on which one Firebase chose to populate.
        val title = message.notification?.title ?: message.data["title"] ?: "Tenable"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: code?.let { "Tap to join — code $it" }
            ?: "A game is starting"
        Push.show(applicationContext, title, body, code)
    }
}
