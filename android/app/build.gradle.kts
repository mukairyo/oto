plugins {
    id("com.android.application")
}

// Set by the GitHub build: the newest stable GeckoView, and the build number as the version.
val geckoVersion: String = (project.findProperty("geckoVersion") as String?) ?: "+"
val vCode: Int = ((project.findProperty("versionCode") as String?) ?: "1").toInt()
val vName: String = (project.findProperty("versionName") as String?) ?: "0.1.0"

android {
    namespace = "app.oto.browser"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "app.oto.browser.test"
        minSdk = 26
        targetSdk = 34
        versionCode = vCode
        versionName = vName
    }

    signingConfigs {
        create("release") {
            val ks = System.getenv("OTO_KS_FILE")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("OTO_KS_PASS")
                keyAlias = System.getenv("OTO_KEY_ALIAS")
                keyPassword = System.getenv("OTO_KS_PASS")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val rel = signingConfigs.getByName("release")
            signingConfig = if (rel.storeFile != null) rel else signingConfigs.getByName("debug")
        }
    }

    // Phones are arm64: one small APK instead of one with every CPU type in it.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a")
            isUniversalApk = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    lint { abortOnError = false; checkReleaseBuilds = false }
    // compress the engine's native libraries in the APK (much smaller download)
    packaging { jniLibs { useLegacyPackaging = true } }
}

dependencies {
    implementation("org.mozilla.geckoview:geckoview:$geckoVersion")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
