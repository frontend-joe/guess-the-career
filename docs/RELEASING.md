# Releasing the apps

Both apps are distributed privately — TestFlight on iOS, an internal testing
track on Android. Neither is listed publicly, which is a deliberate choice: it
removes App Store review, a public privacy policy, moderation and account
deletion flows from the project entirely.

Everything below has been run end to end on this machine except the two upload
steps, which need credentials only you can create.

---

## iOS — TestFlight

### Once

**1. Confirm the Apple Developer Program membership is active.** $99/year, and
required even for TestFlight. The team is `QZA66MATSN`.

**2. Create the app record.** App Store Connect → Apps → **+** → New App.

| Field | Value |
|---|---|
| Platform | iOS |
| Bundle ID | `com.guessthelist.GuessTheList` |
| SKU | anything unique, e.g. `guessthelist-ios` |
| Name | must be unique across the whole App Store |

The name has to be globally unique even for a private beta, so if "Football
Tenable" is taken, pick something else — it is only what testers see in
TestFlight.

**3. Create an App Store Connect API key.** Users and Access → Integrations →
Keys → **+**. Give it the **App Manager** role.

Download the `.p8` **immediately** — like the LiveKit secret, it is shown once
— and put it where the Apple tools look for it:

```sh
mkdir -p ~/.appstoreconnect/private_keys
mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/.appstoreconnect/private_keys/
```

Then keep the Key ID and the Issuer ID (shown above the key list) in your
shell profile:

```sh
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
```

That key can upload builds to your account. It belongs on disk and in your
environment, never in this repo.

### Every build

```sh
cd ios && ./scripts/testflight.sh
```

It regenerates the project, archives, exports a signed `.ipa` and uploads it.
The build number is stamped from the clock, because App Store Connect refuses
a build number it has seen before and that is the easiest mistake to make.

Then: App Store Connect → your app → TestFlight. The build sits in
**Processing** for 5–15 minutes. Add your mates under **Internal Testing** (up
to 100 people, no review, they need an Apple ID and the TestFlight app) or
**External Testing** (up to 10,000, but the first build needs a review pass).

Internal testing is what you want. No review, builds available in minutes.

---

## Android — Play Console internal testing

### Once

**1. Create the upload key.** This is the one irreplaceable thing in this
document: Play ties your app to it, and losing it means a key reset request to
Google.

```sh
cd android
keytool -genkeypair -v -keystore upload-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

It asks for a password and a name. **Back the `.jks` up somewhere that is not
this laptop.**

**2. Tell Gradle about it.** Create `android/keystore.properties`:

```properties
storeFile=upload-key.jks
storePassword=whatever-you-chose
keyAlias=upload
keyPassword=whatever-you-chose
```

Both that file and `*.jks` are gitignored. Without them the release build still
produces an unsigned bundle, so nothing else breaks on a machine that has
never released.

**3. Create a Play Console account.** $25, one-off, not annual.

**4. Create the app.** Play Console → Create app. Name, language, "App" (not
game), Free.

### Every build

```sh
cd android && ./gradlew bundleRelease
# -> app/build/outputs/bundle/release/app-release.aab
```

`versionCode` is stamped from the clock as `YYMMDDHH`, because Play rejects a
version code it has seen before. Override with `-PversionCode=123` if you ever
need to.

### Uploading

1. Play Console → your app → **Testing → Internal testing** → **Create new
   release**.
2. On the first upload, accept **Play App Signing**. Google keeps the real
   signing key; the one you just made becomes the *upload* key. This is what
   makes a lost upload key recoverable at all.
3. Drop in `app-release.aab`, add release notes, **Save** → **Review release**
   → **Start rollout to Internal testing**.
4. **Testers** tab → create an email list → add your mates' Google accounts →
   copy the opt-in link and send it to them. They open the link, accept, and
   install from Play normally.

Internal testing takes a few minutes to go live, allows up to 100 testers, and
skips review.

### The declarations Play will ask for

Even an internal test needs the **App content** section filled in. Answer
honestly — the app does collect things:

- **Data safety**: it collects an email address and password for hosts, and a
  display name for guests. Camera and microphone are used for live video and
  audio between players. Say so.
- **Content rating**: a short questionnaire.
- **Target audience**: not children.
- **Privacy policy**: needed if the data safety form says you collect personal
  data, which it does. A single page on the existing site is enough.

### The 12-tester rule

New *personal* developer accounts must run a closed test with 12 testers for
14 days before they can publish to production. **Internal testing is exempt**,
so for playing with your mates it never applies. It only matters if this ever
goes public.

---

## When the server changes

Both apps talk to Railway directly and hold no schema of their own beyond the
model files. A server change that renames or removes a field will break
whichever app has not been rebuilt — and with no App Store update prompt, that
is every phone until you rebuild and re-upload.

The Android client decodes with `ignoreUnknownKeys`, so *adding* a field is
safe. Removing or renaming one is not, on either platform.
