package uz.suhbat.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import uz.suhbat.app.background.BackgroundPackage
import uz.suhbat.app.background.Notifications

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Fon ulanishi va mahalliy bildirishnomalar (FCM'siz) — background/.
          add(BackgroundPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Kanallar: `messages`, `calls` (FCM bilan bir xil), `connection` (fon ulanishi).
    Notifications.createChannels(this)
    loadReactNative(this)
  }
}
