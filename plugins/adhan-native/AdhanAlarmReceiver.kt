package de.salatibox.tv.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Natives Gegenstueck zu `src/lib/azanRuf.ts`: laesst den Gebetsruf auch
 * feuern, wenn die TV-App NICHT im Vordergrund laeuft. Vorher gab es dafuer
 * ueberhaupt keinen Mechanismus (nur ein JS-`setInterval`, das mit der App
 * stirbt) - siehe Memory project_salati_tv_adhan_architektur.
 *
 * Gleiches Muster wie apps/mobile/.../alarm/WidgetAlarmReceiver.kt, aber mit
 * einem Foreground-Service statt eines reinen Broadcasts: Audio-Wiedergabe
 * braucht ein offenes Media-Session-Fenster, das ein `onReceive()` (kurze
 * Ausfuehrungszeit) nicht garantieren kann.
 *
 * JS liefert fertige Zeitstempel + Sound-Wahl (setSchedule in
 * AdhanAlarmModule.kt) - nativ kennt nur "wann" und "welche der drei
 * mitgelieferten Aufnahmen" (adhan1/adhan2/fajr, s. AZAN_CHOICES in
 * src/lib/azan.ts), NICHT die Gebetszeiten-Berechnung selbst.
 */
class AdhanAlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_ADHAN_ALARM -> {
        val soundKey = intent.getStringExtra(EXTRA_SOUND_KEY)
        val prayerKey = intent.getStringExtra(EXTRA_PRAYER_KEY) ?: ""
        if (!soundKey.isNullOrEmpty() && soundKey != "aus") {
          val serviceIntent = Intent(context, AdhanPlaybackService::class.java)
            .putExtra(AdhanPlaybackService.EXTRA_SOUND_KEY, soundKey)
            .putExtra(AdhanPlaybackService.EXTRA_PRAYER_KEY, prayerKey)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
          } else {
            context.startService(serviceIntent)
          }
        }
        AdhanAlarmScheduler.scheduleNext(context)
      }
      // Neustart/Zeit-/Zeitzonenwechsel: alle Alarme sind weg bzw. beziehen
      // sich auf die falsche Uhr - den naechsten aus dem gespeicherten Plan
      // neu stellen (kein Nachholen eines verpassten Rufs - das waere ein
      // Adhan mitten in der Nacht nach einem verspaeteten Neustart).
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED -> {
        AdhanAlarmScheduler.scheduleNext(context)
      }
    }
  }

  companion object {
    const val TAG = "SalatiTvAdhanAlarm"
    const val ACTION_ADHAN_ALARM = "de.salatibox.tv.ADHAN_ALARM"
    const val EXTRA_SOUND_KEY = "soundKey"
    const val EXTRA_PRAYER_KEY = "prayerKey"
  }
}

/**
 * Persistiert den von JS gelieferten Plan (Zeitstempel + Sound-Wahl je
 * Eintrag) und stellt jeweils den naechsten faelligen Alarm. SharedPreferences
 * statt Datenbank: derselbe Ansatz wie WidgetAlarmScheduler.kt, ausreichend
 * fuer eine Handvoll Eintraege (naechste ~7 Tage x 5 Gebete).
 */
object AdhanAlarmScheduler {
  private const val PREFS = "salati_tv_adhan_alarm"
  private const val KEY_PLAN = "plan"
  private const val REQUEST_CODE = 5823
  // Trenner duerfen nicht in Gebets-/Sound-Schluesseln vorkommen - beide sind
  // feste, kleine Wortlisten (s. AzanPrayer/AzanChoice in src/lib/azan.ts).
  private const val ENTRY_SEP = ";"
  private const val FIELD_SEP = ":"

  private data class Eintrag(val zeitpunkt: Long, val prayerKey: String, val soundKey: String)

  fun store(context: Context, timestampsMs: List<Long>, prayerKeys: List<String>, soundKeys: List<String>) {
    val n = minOf(timestampsMs.size, prayerKeys.size, soundKeys.size)
    val serialisiert = (0 until n).joinToString(ENTRY_SEP) { i ->
      "${timestampsMs[i]}$FIELD_SEP${prayerKeys[i]}$FIELD_SEP${soundKeys[i]}"
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PLAN, serialisiert)
      .apply()
  }

  private fun load(context: Context): List<Eintrag> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PLAN, "") ?: ""
    if (raw.isEmpty()) return emptyList()
    return raw.split(ENTRY_SEP).mapNotNull { stueck ->
      val teile = stueck.split(FIELD_SEP)
      val ts = teile.getOrNull(0)?.toLongOrNull() ?: return@mapNotNull null
      val prayer = teile.getOrNull(1) ?: return@mapNotNull null
      val sound = teile.getOrNull(2) ?: return@mapNotNull null
      Eintrag(ts, prayer, sound)
    }.sortedBy { it.zeitpunkt }
  }

  /**
   * Naechsten Eintrag mit einer AKTIVEN Sound-Wahl (nicht "aus") stellen.
   * Exakt, wenn erlaubt; sonst ungenau statt gar nicht (gleiche Abwaegung wie
   * beim Widget-Alarm: ein paar Minuten spaeter ist besser als nie).
   */
  fun scheduleNext(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val now = System.currentTimeMillis()
    val next = load(context).firstOrNull { it.zeitpunkt > now && it.soundKey != "aus" } ?: return

    val intent = Intent(context, AdhanAlarmReceiver::class.java)
      .setAction(AdhanAlarmReceiver.ACTION_ADHAN_ALARM)
      .putExtra(AdhanAlarmReceiver.EXTRA_SOUND_KEY, next.soundKey)
      .putExtra(AdhanAlarmReceiver.EXTRA_PRAYER_KEY, next.prayerKey)
    val pending = PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val exactAllowed =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
    try {
      if (exactAllowed) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.zeitpunkt, pending)
      } else {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.zeitpunkt, pending)
      }
    } catch (e: SecurityException) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.zeitpunkt, pending)
      Log.w(AdhanAlarmReceiver.TAG, "exakter Alarm abgelehnt, ungenau gestellt", e)
    }
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val intent = Intent(context, AdhanAlarmReceiver::class.java).setAction(AdhanAlarmReceiver.ACTION_ADHAN_ALARM)
    val pending = PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    )
    if (pending != null) {
      alarmManager.cancel(pending)
      pending.cancel()
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_PLAN).apply()
  }
}
