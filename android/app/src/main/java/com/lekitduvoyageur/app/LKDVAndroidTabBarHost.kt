package com.lekitduvoyageur.app

import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.getcapacitor.Bridge
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.navigation.NavigationBarView
import com.google.android.material.shape.CornerFamily
import com.google.android.material.shape.MaterialShapeDrawable
import com.google.android.material.shape.ShapeAppearanceModel

class LKDVAndroidTabBarHost(
    private val activity: AppCompatActivity,
    private val bridge: Bridge?
) {
    val tabIds = listOf("adventures", "explorer", "community", "messages", "me")
    private val tabLabels = listOf("Hub", "Explorer", "Communauté", "Messages", "Compte")
    private val tabIcons = listOf(
        android.R.drawable.ic_menu_today,
        android.R.drawable.ic_menu_compass,
        android.R.drawable.ic_menu_share,
        android.R.drawable.ic_menu_send,
        android.R.drawable.ic_menu_myplaces
    )

    private val navView = BottomNavigationView(activity)
    private var isNativeVisible = false
    private var keyboardShown = false
    private var lastRevision = -1

    val barHeightPx: Int
        get() = (64 * activity.resources.displayMetrics.density).toInt()

    init {
        setupTabBar()
        setupInsets()
    }

    private fun setupTabBar() {
        val density = activity.resources.displayMetrics.density
        val heightPx = barHeightPx
        val marginSidePx = (20 * density).toInt()
        val marginBottomPx = (12 * density).toInt()

        val params = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            heightPx
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            leftMargin = marginSidePx
            rightMargin = marginSidePx
            bottomMargin = marginBottomPx
        }

        // Material 3 Capsule Surface with 28dp radius
        val radiusPx = 28 * density
        val shapeAppearance = ShapeAppearanceModel.builder()
            .setAllCorners(CornerFamily.ROUNDED, radiusPx)
            .build()

        val backgroundDrawable = MaterialShapeDrawable(shapeAppearance).apply {
            fillColor = ColorStateList.valueOf(Color.parseColor("#E6FBFAF6")) // 90% opacity sauge canvas
            strokeWidth = 1 * density
            strokeColor = ColorStateList.valueOf(Color.parseColor("#2417402C")) // 14% alpha forest rim
            elevation = 6 * density
        }
        navView.background = backgroundDrawable

        // Material 3 Colors & Pill indicator
        val activeColor = Color.parseColor("#226148") // @color/lkdv_brand_action
        val inactiveColor = Color.parseColor("#56665D") // @color/lkdv_label_secondary
        val states = arrayOf(
            intArrayOf(android.R.attr.state_selected),
            intArrayOf(-android.R.attr.state_selected)
        )
        val iconColorList = ColorStateList(states, intArrayOf(activeColor, inactiveColor))
        navView.itemIconTintList = iconColorList

        // Active indicator pill
        navView.itemActiveIndicatorColor = ColorStateList.valueOf(Color.parseColor("#335B7F55"))

        navView.labelVisibilityMode = NavigationBarView.LABEL_VISIBILITY_UNLABELED

        // Populate items
        val menu = navView.menu
        menu.clear()
        for (i in tabIds.indices) {
            val item = menu.add(0, i, i, tabLabels[i])
            item.setIcon(tabIcons[i])
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                item.contentDescription = tabLabels[i]
                item.tooltipText = tabLabels[i]
            }
        }

        navView.setOnItemSelectedListener { item ->
            val index = item.itemId
            if (index in tabIds.indices) {
                navView.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                val destination = tabIds[index]
                notifyPlugin(destination)
            }
            true
        }

        navView.visibility = View.GONE

        // Add to activity content view
        val rootView = activity.findViewById<ViewGroup>(android.R.id.content)
        rootView.addView(navView, params)
    }

    private fun setupInsets() {
        val density = activity.resources.displayMetrics.density
        val baseMarginBottom = (12 * density).toInt()

        ViewCompat.setOnApplyWindowInsetsListener(navView) { _, insets ->
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            keyboardShown = imeVisible

            val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val params = navView.layoutParams as? FrameLayout.LayoutParams
            if (params != null) {
                params.bottomMargin = baseMarginBottom + navBarInsets.bottom
                navView.layoutParams = params
            }

            navView.visibility = if (isNativeVisible && !keyboardShown) View.VISIBLE else View.GONE
            insets
        }
    }

    fun setVisible(requested: Bool, selectedId: String?, revision: Int): Boolean {
        if (revision < lastRevision) return isNativeVisible
        lastRevision = revision

        if (selectedId != null) {
            val index = tabIds.indexOf(selectedId)
            if (index != -1) {
                navView.menu.findItem(index)?.isChecked = true
            }
        }

        isNativeVisible = requested
        navView.visibility = if (isNativeVisible && !keyboardShown) View.VISIBLE else View.GONE
        return requested
    }

    private fun notifyPlugin(destination: String) {
        val plugin = bridge?.getPlugin("LKDVAccountTabBar")?.instance as? LKDVAccountTabBarPlugin
        plugin?.sendTabSelection(destination)
    }
}

typealias Bool = Boolean
