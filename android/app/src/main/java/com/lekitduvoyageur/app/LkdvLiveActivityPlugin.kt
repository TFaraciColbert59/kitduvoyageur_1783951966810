package com.lekitduvoyageur.app

import android.content.Intent
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LkdvLiveActivity")
class LkdvLiveActivityPlugin : Plugin() {

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val ret = JSObject()
        ret.put("supported", true)
        ret.put("platform", "android")
        call.resolve(ret)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
            action = LiveOutingNotificationService.ACTION_START
            putExtra("sport", call.getString("sport", "rando"))
            putExtra("startedAt", call.getDouble("startedAt", System.currentTimeMillis().toDouble())?.toLong() ?: System.currentTimeMillis())
            putExtra("distanceM", call.getDouble("distanceM", 0.0) ?: 0.0)
            putExtra("elevGainM", call.getDouble("elevGainM", 0.0) ?: 0.0)
            putExtra("movingS", call.getDouble("movingS", 0.0) ?: 0.0)
            putExtra("paused", call.getBoolean("paused", false) ?: false)
            putExtra("offRoute", call.getBoolean("offRoute", false) ?: false)
        }
        try {
            ContextCompat.startForegroundService(context, intent)
            val ret = JSObject()
            ret.put("supported", true)
            ret.put("id", "android-live-outing")
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("supported", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
            action = LiveOutingNotificationService.ACTION_UPDATE
            putExtra("distanceM", call.getDouble("distanceM", 0.0) ?: 0.0)
            putExtra("elevGainM", call.getDouble("elevGainM", 0.0) ?: 0.0)
            putExtra("movingS", call.getDouble("movingS", 0.0) ?: 0.0)
            putExtra("paused", call.getBoolean("paused", false) ?: false)
            putExtra("offRoute", call.getBoolean("offRoute", false) ?: false)
        }
        try {
            context.startService(intent)
            val ret = JSObject()
            ret.put("supported", true)
            ret.put("id", "android-live-outing")
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("supported", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun end(call: PluginCall) {
        val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
            action = LiveOutingNotificationService.ACTION_STOP
        }
        try {
            context.startService(intent)
            val ret = JSObject()
            ret.put("supported", true)
            ret.put("ended", true)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("supported", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }
}
