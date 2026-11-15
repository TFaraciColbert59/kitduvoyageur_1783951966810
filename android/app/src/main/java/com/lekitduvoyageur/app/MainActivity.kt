package com.lekitduvoyageur.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    var tabBarHost: LKDVAndroidTabBarHost? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(LKDVAccountTabBarPlugin::class.java)
        registerPlugin(LKDVNativeUIPlugin::class.java)
        registerPlugin(LkdvLiveActivityPlugin::class.java)
        super.onCreate(savedInstanceState)
        tabBarHost = LKDVAndroidTabBarHost(this, bridge)
    }
}
