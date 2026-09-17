package com.spoonful

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Spoonful"

  /**
   * 3.2.3: Die System-Navigationsleiste (Gesten/3-Tasten) verschwindet, solange
   * die App offen ist — wie bei vielen anderen Apps. Sie kommt durch eine
   * Wischgeste kurz zurück ("sticky immersive") und versteckt sich danach
   * wieder. Die Statusleiste bleibt sichtbar.
   *
   * 3.3.0: Wichtig für die Tastatur — `setDecorFitsSystemWindows(false)` (echtes
   * Edge-to-Edge) ist wieder raus. Auf Android 14 und älter wirkt `adjustResize`
   * aus dem Manifest dann wieder und die Tastatur schiebt die Eingabefelder
   * nach oben. Auf Android 15+ (dort erzwingt Android Edge-to-Edge und der
   * Aufruf ist wirkungslos) übernimmt das eine KeyboardAvoidingView in App.tsx.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyImmersiveMode()
  }

  private fun applyImmersiveMode() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      /* true = Fenster passt sich den Systemleisten an (adjustResize wirkt). */
      window.setDecorFitsSystemWindows(true)
      val controller = window.insetsController ?: return
      controller.hide(WindowInsets.Type.navigationBars())
      controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    }
  }

  /** Nach Fokuswechsel (z. B. zurück aus einer anderen App) erneut verstecken. */
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applyImmersiveMode()
  }

  /**
   * 3.2.1: Das ist der Grund, warum das Teilen-Ziel bisher nur beim ersten Start
   * funktioniert hat. Wenn Spoonful schon läuft (launchMode singleTask), kommt
   * ein neuer "Teilen"-Aufruf über onNewIntent - ohne setIntent() sieht das
   * ShareIntent-Modul weiter den alten Intent und findet den Link nicht.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

