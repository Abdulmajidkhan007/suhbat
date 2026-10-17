package uz.suhbat.app.background

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import uz.suhbat.app.MainActivity
import uz.suhbat.app.R

/**
 * Mahalliy bildirishnomalar (FCM'siz): kanallar, xabar/qo'ng'iroq bildirishnomasi va
 * fon ulanishining doimiy "Suhbat ulangan" bildirishnomasi.
 */
object Notifications {
  /** FCM (`firebase.json`, API `channel_id`) bilan bir xil kanallar. */
  const val CHANNEL_MESSAGES = "messages"
  const val CHANNEL_CALLS = "calls"
  const val CHANNEL_CONNECTION = "connection"

  /** Bildirishnoma bosilganda ochiladigan chat (MainActivity intent'ida). */
  const val EXTRA_CHAT_ID = "uz.suhbat.app.CHAT_ID"

  const val CONNECTION_NOTIFICATION_ID = 1001

  /**
   * FCM ham Android'da `tag = chatId`, `id = 0` bilan ko'rsatadi — mahalliy va FCM
   * bildirishnomasi bir chat uchun bir-birini almashtiradi (dublikat bo'lmaydi).
   */
  private const val MESSAGE_NOTIFICATION_ID = 0

  fun createChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_MESSAGES, context.getString(R.string.notification_channel_messages), NotificationManager.IMPORTANCE_HIGH),
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_CALLS, context.getString(R.string.notification_channel_calls), NotificationManager.IMPORTANCE_HIGH),
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_CONNECTION, context.getString(R.string.notification_channel_connection), NotificationManager.IMPORTANCE_MIN).apply {
        description = context.getString(R.string.notification_channel_connection_description)
        setShowBadge(false)
      },
    )
  }

  /** Ilovani ochadi; `chatId` bo'lsa — shu chatni. */
  fun openApp(context: Context, chatId: String?, requestCode: Int): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      if (chatId != null) putExtra(EXTRA_CHAT_ID, chatId)
    }
    return PendingIntent.getActivity(
      context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** POST_NOTIFICATIONS yo'q bo'lsa `areNotificationsEnabled()` false — tekshirilgan. */
  @SuppressLint("MissingPermission")
  fun show(context: Context, tag: String, channel: String, title: String, body: String, chatId: String) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    val isCall = channel == CHANNEL_CALLS
    val notification = NotificationCompat.Builder(context, if (isCall) CHANNEL_CALLS else CHANNEL_MESSAGES)
      .setSmallIcon(R.drawable.ic_stat_suhbat)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setCategory(if (isCall) NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(openApp(context, chatId, tag.hashCode()))
      .build()
    try {
      manager.notify(tag, MESSAGE_NOTIFICATION_ID, notification)
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS ruxsati yo'q (Android 13+).
      Log.w("SuhbatBackground", "bildirishnoma ko'rsatilmadi: ${e.message}")
    }
  }

  fun cancel(context: Context, tag: String) {
    NotificationManagerCompat.from(context).cancel(tag, MESSAGE_NOTIFICATION_ID)
  }

  fun connection(context: Context): Notification =
    NotificationCompat.Builder(context, CHANNEL_CONNECTION)
      .setSmallIcon(R.drawable.ic_stat_suhbat)
      .setContentTitle(context.getString(R.string.connection_title))
      .setContentText(context.getString(R.string.connection_text))
      .setOngoing(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(openApp(context, null, CONNECTION_NOTIFICATION_ID))
      .build()
}
