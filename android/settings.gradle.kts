// Phase 4: the Android client. Same server, same sync contract as iOS.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        // LiveKit's audio routing dependency (audioswitch) is published here
        // and nowhere else, so the SDK will not resolve without it.
        maven("https://jitpack.io")
    }
}
rootProject.name = "GuessTheList"
include(":app")
