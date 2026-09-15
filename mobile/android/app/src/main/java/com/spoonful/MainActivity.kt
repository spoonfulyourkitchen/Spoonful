package com.spoonful

import android.content.Intent
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
