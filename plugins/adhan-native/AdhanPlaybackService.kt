package de.salatibox.tv.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import de.salatibox.tv.R

/**
 * Foreground-Service, der EINE Adhan-Aufnahme abspielt und sich danach selbst
 * beendet. Kein Dauerdienst - er lebt nur so lange wie eine Wiedergabe
 * (typisch 1-4 Minuten), ausgeloest von AdhanAlarmReceiver.
 *
 * Foreground (statt ein einfacher `MediaPlayer` im Hintergrund) ist noetig,
 * damit Android die Wiedergabe nicht sofort abwuergt, wenn die App gerade
 * nicht sichtbar ist - genau der Fall, den der alte JS-only-Mechanismus
 * (src/lib/azanRuf.ts) nicht abdecken konnte.
 *
 * Die drei moeglichen Aufnahmen liegen als natives raw-Resource (nicht als
 * RN/Metro-Asset - deren Dateiname bekommt beim Bundling einen Hash, den
 * natives Java/Kotlin nicht kennt). Das Config-Plugin
 * (plugins/with-adhan-alarm.js) kopiert dieselben Quelldateien wie die App
 * (assets/audio/azan, adhan1/adhan2/fajr als mp3) zusaetzlich nach
 * android/app/src/main/res/raw/.
 */
class AdhanPlaybackService : Service() {
  private var player: MediaPlayer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val soundKey = intent?.getStringExtra(EXTRA_SOUND_KEY)
    val resId = RAW_RES_BY_KEY[soundKey]
    if (resId == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    ensureChannel()
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Salati")
      .setContentText("Gebetsruf")
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      } else {
        0
      },
    )

    try {
      player?.release()
      player = MediaPlayer.create(this, resId)?.apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build(),
        )
        setOnCompletionListener { stopSelfSafely() }
        setOnErrorListener { _, _, _ -> stopSelfSafely(); true }
        start()
      }
      if (player == null) stopSelfSafely()
    } catch (e: Exception) {
      Log.w(TAG, "Adhan-Wiedergabe fehlgeschlagen", e)
      stopSelfSafely()
    }
    return START_NOT_STICKY
  }

  private fun stopSelfSafely() {
    try {
      player?.release()
    } catch (_: Exception) {
    }
    player = null
    ServiceCompat.stopForeground(this, Service.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    try {
      player?.release()
    } catch (_: Exception) {
    }
    player = null
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Gebetsruf", NotificationManager.IMPORTANCE_LOW),
    )
  }

  companion object {
    const val TAG = "SalatiTvAdhanPlayback"
    const val EXTRA_SOUND_KEY = "soundKey"
    const val EXTRA_PRAYER_KEY = "prayerKey"
    private const val CHANNEL_ID = "salati_adhan"
    private const val NOTIFICATION_ID = 5824

    // Namen MUESSEN zu den res/raw-Dateien passen, die with-adhan-alarm.js
    // erzeugt (aus assets/audio/azan/*.mp3) - und zu AZAN_CHOICES in
    // src/lib/azan.ts ('aus' hat bewusst keinen Eintrag: wird schon im
    // Receiver herausgefiltert).
    val RAW_RES_BY_KEY: Map<String, Int> = mapOf(
      "adhan1" to R.raw.adhan1,
      "adhan2" to R.raw.adhan2,
      "fajr" to R.raw.fajr,
    )
  }
}
