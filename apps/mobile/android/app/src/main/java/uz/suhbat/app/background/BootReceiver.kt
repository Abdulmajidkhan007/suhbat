package uz.suhbat.app.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Telefon qayta yoqilganda / ilova yangilanganda fon ulanishini tiklaydi (sozlamada yoqilgan bo'lsa). */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!BackgroundPrefs.isEnabled(context)) return
    try {
      ConnectionService.start(context)
    } catch (e: Exception) {
      Log.w("SuhbatBackground", "boot: service boshlanmadi: ${e.message}")
    }
  }
}
