package uz.suhbat.app.background

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.lang.ref.WeakReference

/**
 * JS ↔ Android: fon ulanishi (foreground service), mahalliy bildirishnomalar, batareya
 * optimizatsiyasi va bildirishnoma bosilganda ochiladigan chat. JS tomoni — `src/background/native.ts`.
 */
class BackgroundModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  init {
    current = WeakReference(context)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun isEnabled(promise: Promise) {
    promise.resolve(BackgroundPrefs.isEnabled(reactApplicationContext))
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    BackgroundPrefs.setEnabled(reactApplicationContext, enabled)
    promise.resolve(null)
  }

  @ReactMethod
  fun startService(promise: Promise) {
    try {
      ConnectionService.start(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SERVICE", e.message, e)
    }
  }

  @ReactMethod
  fun stopService() {
    ConnectionService.stop(reactApplicationContext)
  }

  @ReactMethod
  fun showNotification(tag: String, channel: String, title: String, body: String, chatId: String) {
    Notifications.show(reactApplicationContext, tag, channel, title, body, chatId)
  }

  @ReactMethod
  fun cancelNotification(tag: String) {
    Notifications.cancel(reactApplicationContext, tag)
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    val power = reactApplicationContext.getSystemService(PowerManager::class.java)
    promise.resolve(power?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) ?: false)
  }

  /** Tizim oynasi: "Batareya optimizatsiyasidan chiqarilsinmi?" Bo'lmasa — umumiy ro'yxat sozlamasi. */
  @SuppressLint("BatteryLife")
  @ReactMethod
  fun requestIgnoreBatteryOptimizations() {
    val context = reactApplicationContext
    val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
    val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    for (intent in listOf(direct, fallback)) {
      try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return
      } catch (e: Exception) {
        Log.w(NAME, "batareya sozlamasi ochilmadi: ${e.message}")
      }
    }
  }

  /** Bildirishnoma bosilib ochilgan chat (bir marta beriladi). */
  @ReactMethod
  fun consumeOpenChat(promise: Promise) {
    promise.resolve(takePendingChat())
  }

  companion object {
    const val NAME = "SuhbatBackground"
    const val EVENT_OPEN_CHAT = "suhbatOpenChat"

    private var current: WeakReference<ReactApplicationContext>? = null
    private var pendingChat: String? = null

    @Synchronized
    private fun takePendingChat(): String? = pendingChat.also { pendingChat = null }

    /** MainActivity'dan: intent'da chat bo'lsa saqlanadi va JS'ga xabar beriladi (JS `consumeOpenChat` chaqiradi). */
    @Synchronized
    fun handleIntent(intent: Intent?) {
      val chatId = intent?.getStringExtra(Notifications.EXTRA_CHAT_ID) ?: return
      intent.removeExtra(Notifications.EXTRA_CHAT_ID)
      pendingChat = chatId
      val context = current?.get() ?: return
      if (context.hasActiveReactInstance()) context.emitDeviceEvent(EVENT_OPEN_CHAT, null)
    }
  }
}
