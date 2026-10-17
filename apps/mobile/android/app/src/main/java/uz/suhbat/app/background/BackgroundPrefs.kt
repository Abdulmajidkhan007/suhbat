package uz.suhbat.app.background

import android.content.Context

/** Fon ulanishi yoqilganmi (sozlamalarda; qayta yuklashdan keyin ham kerak — BootReceiver). */
object BackgroundPrefs {
  private const val FILE = "suhbat_background"
  private const val KEY_ENABLED = "enabled"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }
}
