package com.spoonful

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager

/**
 * 3.2.0: Teilen-Ziel — wenn in TikTok/Instagram/YouTube auf "Teilen" getippt
 * wird, taucht Spoonful auf. Der Link landet in EXTRA_TEXT und wird hier an
 * die App (JS) weitergegeben.
 */
class ShareIntentModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "ShareIntent"

  private fun sharedText(): String? {
    val intent = currentActivity?.intent ?: return null
    if (intent.type != null && intent.type != "text/plain") return null
    return intent.getStringExtra(Intent.EXTRA_TEXT)
  }

  @ReactMethod
  fun getSharedText(promise: Promise) {
    try {
      promise.resolve(sharedText())
    } catch (e: Exception) {
      promise.reject("share_read_failed", e)
    }
  }

  /** Nach dem Verarbeiten den Extra entfernen, damit er nicht doppelt kommt. */
  @ReactMethod
  fun clear() {
    try {
      currentActivity?.intent?.removeExtra(Intent.EXTRA_TEXT)
    } catch (_: Exception) {
    }
  }
}

class ShareIntentPackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(ShareIntentModule(ctx))
  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
