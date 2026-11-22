# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# 3.3.3: Diese Regeln sind die Versicherung, falls `minifyEnabled` (R8) später
# doch eingeschaltet wird. Für den aktuellen Release-Build ist Minifizierung
# AUS (siehe build.gradle): Hermes liefert schon Bytecode, R8 bringt nur wenige
# MB und kann bei nativen Modulen (Notifee, WebView, ZXing) schwer zu findende
# Abstürze beim Start verursachen.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**
