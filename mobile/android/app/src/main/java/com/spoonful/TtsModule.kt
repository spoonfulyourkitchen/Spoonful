package com.spoonful

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class TtsModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private var tts: TextToSpeech? = null
  private var ready = false

  init {
    tts = TextToSpeech(context) { status ->
      ready = status == TextToSpeech.SUCCESS
    }
  }

  override fun getName(): String = "SpoonfulTts"

  @ReactMethod
  fun available(promise: Promise) {
    promise.resolve(ready)
  }

  
  @ReactMethod
  fun speak(text: String, lang: String, promise: Promise) {
    val engine = tts
    if (engine == null || !ready) {
      promise.resolve(false)
      return
    }
    try {
      val locale = localeFor(lang)
      engine.language = locale
      if (engine.isLanguageAvailable(locale) == TextToSpeech.LANG_MISSING_DATA ||
        engine.isLanguageAvailable(locale) == TextToSpeech.LANG_NOT_SUPPORTED
      ) {
        engine.language = Locale.US
      }
      engine.stop()
      engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "spoonful-step")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("tts_failed", e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      tts?.stop()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("tts_failed", e)
    }
  }

  private fun localeFor(tag: String): Locale {
    val cleaned = tag.trim().replace('_', '-')
    if (cleaned.isEmpty()) return Locale.US
    val parts = cleaned.split('-')
    return if (parts.size >= 2) {
      val region = parts[1].uppercase(Locale.US)
      if (region.length == 2) Locale(parts[0].lowercase(Locale.US), region)
      else Locale(parts[0].lowercase(Locale.US))
    } else {
      Locale(parts[0].lowercase(Locale.US))
    }
  }

  override fun invalidate() {
    tts?.stop()
    tts?.shutdown()
    tts = null
    ready = false
    super.invalidate()
  }
}
