plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val code = (System.getenv("VERSION_CODE") ?: "1").toInt()
android {
    namespace = "com.oscarvelz.logos"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.oscarvelz.logos"
        minSdk = 29
        targetSdk = 34
        versionCode = code
        versionName = "1.$code"
    }
    signingConfigs {
        create("rel") {
            storeFile = file("../logos.p12")
            storePassword = System.getenv("KS_PASS")
            keyAlias = "logos"
            keyPassword = System.getenv("KS_PASS")
            storeType = "pkcs12"
        }
    }
    buildTypes { release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("rel") } }
    buildFeatures { buildConfig = true }
    lint { checkReleaseBuilds = false; abortOnError = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
