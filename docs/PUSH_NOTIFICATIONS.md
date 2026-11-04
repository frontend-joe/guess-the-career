# Push notifications

Creating a game sends every other known phone a notification; tapping it opens
the same `/join/<CODE>` link an invite message carries. Before this, the only
way to learn a game had started was to be told.

Everything in the repo is built and tested. What is left is two sets of
credentials, which only you can create, and the feature is **inert without
them** — the server reports `push: false` on `/api/health`, nothing is sent,
and nothing breaks. You can do iOS and Android independently; either one on its
own is a working feature for those phones.

---

## How it works

```
host taps Create
  → POST /api/rooms                          (carries the host's own push token)
  → createRoom()                             room committed to SQLite
  → sendInvite()                             fire-and-forget, NOT awaited
      ├── APNs   HTTP/2 + ES256 JWT    →  iPhones
      └── FCM v1 OAuth2 service account →  Android phones
  → each phone shows "Joe started a game — tap to join, code ABC123"
  → tap → handleInvite("https://guessthelist.xyz/join/ABC123")
```

Three decisions worth knowing before changing any of it.

**The audience is every live phone except the host's own.** There is no friends
list because there are no accounts to build one from — guests join with a code
and a typed name, deliberately (see `0087_game_rooms.sql`). At one group of
mates, "everybody else" *is* the guest list. The host's phone is excluded by
`user_id`, which is why `POST /api/rooms` carries a push token: the server has
to know which phone the host is on before it sends an invite that must skip it.

**A phone can only register itself while it holds a seat.** The notification
body carries a join code, so an unauthenticated registration endpoint would let
anyone who found it have themselves invited into your games. A first
registration therefore needs the participant token of a game you are in — proof
somebody invited you — and every call after that uses a device secret the
server hands back. In practice: **after updating, each player joins one game by
link as usual, and from then on the games come to them.**

**Nothing is awaited.** The room is already committed when `sendInvite` runs.
Putting Apple's and Google's latency inside the host's "Create" tap, or letting
their failure turn a created room into a 500, would be a bad trade for a
message whose worst case is that you send the link by hand exactly as before.

---

## iOS — APNs

### Once

**1. The Push Notifications capability is already enabled** on the App ID.
`xcodebuild -allowProvisioningUpdates` added it while building, and the signed
binary carries `aps-environment`, so there is nothing to tick in the portal.

**2. Create an APNs Auth Key.** [Apple Developer][dev] → Certificates,
Identifiers & Profiles → **Keys** → **+**. Tick **Apple Push Notifications
service (APNs)**, name it anything, Continue, Register.

Download the `.p8` **immediately** — like every other Apple key, it is shown
once and cannot be re-downloaded. Note the **Key ID** on that page.

This is a *different* key from the App Store Connect key in
`~/.appstoreconnect/private_keys`. That one uploads builds; this one sends
notifications. Keeping them apart is deliberate — the push key goes to the
server, and the upload key never leaves this laptop.

[dev]: https://developer.apple.com/account/resources/authkeys/list

**3. Put it in Railway.** Variables on the server service:

| Variable | Value |
|---|---|
| `APNS_KEY_ID` | the Key ID from step 2, e.g. `ABC123DEFG` |
| `APNS_TEAM_ID` | `QZA66MATSN` |
| `APNS_PRIVATE_KEY` | the **entire** contents of the `.p8`, `-----BEGIN PRIVATE KEY-----` line included |
| `APNS_TOPIC` | optional; defaults to `com.guessthelist.GuessTheList` |

`APNS_PRIVATE_KEY` is a PEM file, so its newlines matter. Railway's
multi-line paste is fine; if a tool flattens them to a literal `\n`, the server
unflattens it, because a mangled key fails with an error about the PEM header
that sends you looking in the wrong place entirely.

**Do not paste the `.p8` into a chat.** It only ever needs to exist on disk
here and in Railway's variables.

### The two gateways

A device token from a **development** build is valid only on Apple's sandbox
host, and one from a **TestFlight** build only on production. Nothing in the
token says which, and the wrong host answers `BadDeviceToken` — identical to a
phone with the app deleted.

So `project.yml` points each configuration at its own entitlements file
(`GuessTheList.Debug.entitlements` → `development`,
`GuessTheList.Release.entitlements` → `production`), and the server tries the
other gateway on `BadDeviceToken` and records which one answered. This is also
what repairs a phone that moves from a local build to a TestFlight one.

---

## Android — FCM

### Once

**1. Create a Firebase project.** [console.firebase.google.com][fb] → Add
project. Google Analytics is not needed.

[fb]: https://console.firebase.google.com/

**2. Add an Android app to it.** Package name **`com.guessthelist.app`**,
exactly. No SHA-1 is needed — that is for Google Sign-In, not messaging.

**3. Download `google-services.json`** and put it at:

```
android/app/google-services.json
```

This file is **not a secret**: it ships inside every copy of the app. Commit it.
Without it the build still works — Gradle prints "google-services.json not
found — building without push notifications" and the app runs normally, it just
never receives a token.

**4. Create a service account for the server.** Firebase Console → ⚙ Project
settings → **Service accounts** → **Generate new private key**. This downloads
a JSON file.

**This one IS a secret.** It is the credential that can send notifications to
every copy of the app. It does not belong in the repo.

**5. Put it in Railway.** One variable:

| Variable | Value |
|---|---|
| `FCM_SERVICE_ACCOUNT` | the entire contents of the JSON file from step 4 |

Paste the whole document, braces included. The server parses it and pulls out
`project_id`, `client_email` and `private_key`.

---

## Checking it worked

```sh
curl -s https://server-production-2e32.up.railway.app/api/health | jq '{push, pushMissing}'
```

`push: true` with an empty `pushMissing` means both platforms are wired.
`pushMissing: ["FCM_SERVICE_ACCOUNT"]` names exactly what is absent — by
variable name, since a name is not a secret and the alternative is a silent
"no notifications" that tells you nothing.

Then: update both phones, join one game on each so they register, end it, and
create a new one. The other phone should buzz.

If it does not, the server logs say why per device — `push: apns to device 3
failed: <reason>`, or `push: disabling device 3 (Unregistered)`. The reasons are
Apple's and Google's own strings, so they are searchable.

---

## Turning it off

Each phone can mute itself: `POST /api/push/devices/mute` with its secret. The
audience for an invite is "every phone that is not the host's", so asking is the
only way off the list, and a notification you cannot turn off is one people
escape by disabling the app's notifications entirely.

A dead token disables itself. When Apple or Google says a token is gone the row
is marked `disabled_at` rather than deleted, so a reinstall under the same name
does not look like a new person — and a bug that disables everybody is visible
afterwards instead of silently erased.
