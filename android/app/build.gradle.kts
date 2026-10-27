import java.text.SimpleDateFormat
import java.util.Date
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
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
}
