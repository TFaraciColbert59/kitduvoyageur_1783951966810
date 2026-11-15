package com.lekitduvoyageur.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LKDVAccountTabBar")
class LKDVAccountTabBarPlugin : Plugin() {

    @PluginMethod
    fun setVisible(call: PluginCall) {
        val visible = call.getBoolean("visible", false) ?: false
        val selectedId = call.getString("selectedId")
        val revision = call.getInt("revision", 0) ?: 0

        activity.runOnUiThread {
            val mainActivity = activity as? MainActivity
            val host = mainActivity?.tabBarHost
            val active = host?.setVisible(visible, selectedId, revision) ?: false
            val height = host?.barHeightPx ?: 0

            val ret = JSObject()
            ret.put("active", active)
            ret.put("height", height)
            call.resolve(ret)
        }
    }

    fun sendTabSelection(tabId: String) {
        val data = JSObject()
        data.put("destination", tabId)
        notifyListeners("tabSelected", data)
    }
}
