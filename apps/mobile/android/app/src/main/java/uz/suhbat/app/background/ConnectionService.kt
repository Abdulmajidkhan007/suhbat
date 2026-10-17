package uz.suhbat.app.background

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication

/**
 * Foreground service: ilova fonda yoki "yopilgan" (recents'dan surilgan) bo'lsa ham jarayonni
 * tirik saqlaydi — JS'dagi Socket.IO ulanishi uzilmaydi va yangi xabar mahalliy bildirishnoma
 * bilan ko'rsatiladi (FCM kerak emas). Doimiy "Suhbat ulangan" bildirishnomasi bilan.
 *
 * Tizim jarayonni o'ldirib qayta yaratsa (START_STICKY) yoki telefon qayta yoqilsa (BootReceiver),
 * JS ilovasiz (oynasiz) ishga tushiriladi: `index.js` fon ulanishini o'zi tiklaydi.
 */
class ConnectionService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Notifications.createChannels(this)
    if (!enterForeground()) return
    startReact()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!enterForeground()) return START_NOT_STICKY
    return START_STICKY
  }

  private fun enterForeground(): Boolean =
    try {
      val notification = Notifications.connection(this)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(Notifications.CONNECTION_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
      } else {
        startForeground(Notifications.CONNECTION_NOTIFICATION_ID, notification)
      }
      true
    } catch (e: Exception) {
      // Android 12+: fondan foreground service boshlash cheklangan bo'lishi mumkin.
      Log.w(TAG, "foreground service boshlanmadi: ${e.message}")
      stopSelf()
      false
    }

  /** JS ishlamayotgan bo'lsa (jarayon qayta yaratilgan) — oynasiz ishga tushiradi. */
  private fun startReact() {
    try {
      (application as? ReactApplication)?.reactHost?.start()
    } catch (e: Exception) {
      Log.w(TAG, "React ishga tushmadi: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "SuhbatBackground"

    fun start(context: Context) {
      ContextCompat.startForegroundService(context, Intent(context, ConnectionService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ConnectionService::class.java))
    }
  }
}
