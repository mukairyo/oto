plugins {
    // AGP 9 compiles Kotlin itself (built-in Kotlin). Declaring the Kotlin plugin here (not applied) only picks
    // the Kotlin compiler version, so it matches the Kotlin libraries GeckoView brings in.
    id("com.android.application") version "9.4.0" apply false
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
}
