plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    // Applied conditionally in app/build.gradle.kts: the plugin FAILS the
    // build when google-services.json is absent, and the build has to keep
    // working on a machine that has no Firebase project.
    id("com.google.gms.google-services") version "4.4.2" apply false
}
