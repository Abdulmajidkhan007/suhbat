package uz.suhbat.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    loadReactNative(this)
  }

  /**
   * Push kanallari (API `channel_id` bilan bir xil): `messages` — xabarlar (firebase.json'dagi standart),
   * `calls` — kiruvchi qo'ng'iroq.
   */
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    for ((id, name) in listOf(
      "messages" to R.string.notification_channel_messages,
      "calls" to R.string.notification_channel_calls,
    )) {
      manager.createNotificationChannel(NotificationChannel(id, getString(name), NotificationManager.IMPORTANCE_HIGH))
    }
  }
}
