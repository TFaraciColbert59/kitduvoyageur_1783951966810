package com.lekitduvoyageur.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.Locale

class LiveOutingNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "lkdv_live_outing_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.lekitduvoyageur.app.action.START_OUTING"
        const val ACTION_UPDATE = "com.lekitduvoyageur.app.action.UPDATE_OUTING"
        const val ACTION_STOP = "com.lekitduvoyageur.app.action.STOP_OUTING"
        const val ACTION_TOGGLE_PAUSE = "com.lekitduvoyageur.app.action.TOGGLE_PAUSE"
    }

    private var sport: String = "rando"
    private var startedAt: Long = System.currentTimeMillis()
    private var distanceM: Double = 0.0
    private var elevGainM: Double = 0.0
    private var movingS: Double = 0.0
    private var paused: Boolean = false
    private var offRoute: Boolean = false
    private var nextManeuverInstruction: String? = null
    private var nextManeuverDistanceM: Double = -1.0
    private var offRouteLabel: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                sport = intent.getStringExtra("sport") ?: "rando"
                startedAt = intent.getLongExtra("startedAt", System.currentTimeMillis())
                distanceM = intent.getDoubleExtra("distanceM", 0.0)
                elevGainM = intent.getDoubleExtra("elevGainM", 0.0)
                movingS = intent.getDoubleExtra("movingS", 0.0)
                paused = intent.getBooleanExtra("paused", false)
                offRoute = intent.getBooleanExtra("offRoute", false)
                nextManeuverInstruction = intent.getStringExtra("nextManeuverInstruction")
                nextManeuverDistanceM = intent.getDoubleExtra("nextManeuverDistanceM", -1.0)
                offRouteLabel = intent.getStringExtra("offRouteLabel")
                startAsForeground()
            }
            ACTION_UPDATE -> {
                distanceM = intent.getDoubleExtra("distanceM", distanceM)
                elevGainM = intent.getDoubleExtra("elevGainM", elevGainM)
                movingS = intent.getDoubleExtra("movingS", movingS)
                paused = intent.getBooleanExtra("paused", paused)
                offRoute = intent.getBooleanExtra("offRoute", offRoute)
                nextManeuverInstruction = intent.getStringExtra("nextManeuverInstruction")
                nextManeuverDistanceM = intent.getDoubleExtra("nextManeuverDistanceM", -1.0)
                offRouteLabel = intent.getStringExtra("offRouteLabel")
                updateNotification()
            }
            ACTION_TOGGLE_PAUSE -> {
                paused = !paused
                updateNotification()
            }
            ACTION_STOP -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Sortie en cours LKDV",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Affichage temps réel de l'activité sportive en cours"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): NotificationCompat.Builder {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpenIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val toggleIntent = Intent(this, LiveOutingNotificationService::class.java).apply {
            action = ACTION_TOGGLE_PAUSE
        }
        val pendingToggleIntent = PendingIntent.getService(
            this,
            1,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val pauseResumeAction = NotificationCompat.Action.Builder(
            if (paused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause,
            if (paused) "Reprendre" else "Pause",
            pendingToggleIntent
        ).build()

        val title = "${sport.replaceFirstChar { it.uppercase() }} · " + if (paused) "En pause" else "En cours"
        val maneuverText = nextManeuverInstruction?.takeIf { it.isNotBlank() }?.let { instr ->
            if (nextManeuverDistanceM >= 0.0) {
                val distLabel = if (nextManeuverDistanceM >= 1000.0) {
                    String.format(Locale.FRENCH, "%.1f km", nextManeuverDistanceM / 1000.0)
                } else {
                    "${nextManeuverDistanceM.toInt()} m"
                }
                "$instr ($distLabel)"
            } else {
                instr
            }
        }
        val baseStats = String.format(
            Locale.FRENCH,
            "%.1f km · %d m D+%s",
            distanceM / 1000.0,
            elevGainM.toInt(),
            if (offRoute) " · ${offRouteLabel ?: "Hors trace"}" else ""
        )
        val subtitle = if (maneuverText != null) "$maneuverText · $baseStats" else baseStats

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setStyle(NotificationCompat.BigTextStyle().bigText(subtitle))
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(pendingOpenIntent)
            .addAction(pauseResumeAction)
            .setUsesChronometer(!paused)
            .setWhen(startedAt)
            .setPriority(NotificationCompat.PRIORITY_LOW)
    }

    private fun startAsForeground() {
        val notification = buildNotification().build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification().build())
    }
}
