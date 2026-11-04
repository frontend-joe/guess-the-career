import java.text.SimpleDateFormat
import java.util.Date
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Firebase, for push notifications, and only if this checkout has the config.
//
// The google-services plugin's whole job is to turn google-services.json into
// Android resources, and it fails the build outright when the file is missing
// rather than skipping. That would mean nobody could build the app until a
// Firebase project existed, so it is applied only when the file is actually
// there. Without it the app still compiles and runs — Push.start() finds no
// Firebase and logs that notifications are off. See Push.kt.
//
// google-services.json is NOT a secret: it ships inside every copy of the app.
// The service account that lets the SERVER send is the secret, and that lives
// in Railway's variables as FCM_SERVICE_ACCOUNT.
val firebaseConfig = file("google-services.json")
if (firebaseConfig.exists()) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.lifecycle("google-services.json not found — building without push notifications")
}

// Signing details live in keystore.properties, which is gitignored. The
// keystore itself is the one thing here that cannot be regenerated: lose it
// and every future upload has to go through Play's key reset. Back it up
// somewhere that is not this machine.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { stream -> load(stream) }
}

android {
    namespace = "com.guessthelist.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.guessthelist.app"
        minSdk = 26
        targetSdk = 36
        // Play rejects a versionCode it has already seen, so it is stamped
        // from the clock as YYMMDDHH. Note `java` on its own is the Gradle
        // Java extension inside a build script, not the package, so these
        // come in as imports. A plain integer rather than the iOS build
        // number's full timestamp, because versionCode must fit in a signed
        // 32-bit int.
        versionCode = (project.findProperty("versionCode") as String?)?.toInt()
            ?: SimpleDateFormat("yyMMddHH").format(Date()).toInt()
        versionName = "0.1"
    }

    signingConfigs {
        create("release") {
            // Absent on a machine that has never released; the build then
            // produces an unsigned bundle rather than failing, so CI and a
            // plain `assembleDebug` still work.
            if (keystoreProperties.containsKey("storeFile")) {
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystoreProperties.containsKey("storeFile")) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Same SDK family as the iOS app; the server talks to both the same way.
    implementation("io.livekit:livekit-android:2.18.2")
    implementation("io.livekit:livekit-android-compose-components:1.3.1")

    // Declared unconditionally even though the plugin above is not. The
    // library resolves from Maven with no config file, and its initialiser
    // logs a warning rather than throwing when there is no google_app_id — so
    // a build without google-services.json links and runs, it simply never
    // receives a token.
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")

    // Pinned because Firebase drags androidx.fragment down to 1.1.0, and
    // MainActivity's registerForActivityResult — which is what asks for the
    // camera, the microphone and notification permission — is documented as
    // unsafe below 1.3.0. Gradle resolves to the HIGHEST requested version, so
    // one explicit line settles it; lintVitalRelease catches it either way and
    // fails the release build, which is how this was found.
    implementation("androidx.fragment:fragment:1.8.5")
}
