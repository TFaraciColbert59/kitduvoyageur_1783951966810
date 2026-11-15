package com.lekitduvoyageur.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.widget.EditText
import android.widget.FrameLayout
import androidx.activity.result.ActivityResult
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@CapacitorPlugin(name = "LKDVNativeUI")
class LKDVNativeUIPlugin : Plugin() {

    private var activeRoute: String = "/"

    @PluginMethod
    fun setRoute(call: PluginCall) {
        activeRoute = call.getString("path", "/") ?: "/"
        val ret = JSObject()
        ret.put("active", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun getCapabilities(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        ret.put("dates", true)
        ret.put("choices", true)
        ret.put("photos", true)
        ret.put("files", true)

        val biometricManager = BiometricManager.from(context)
        val canAuth = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS
        ret.put("biometrics", canAuth)
        call.resolve(ret)
    }

    @PluginMethod
    fun presentActions(call: PluginCall) {
        val title = call.getString("title", "") ?: ""
        val message = call.getString("message")
        val actionsArray = call.getArray("actions")

        if (actionsArray == null || actionsArray.length() == 0) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
            return
        }

        val actionIds = mutableListOf<String>()
        val actionTitles = mutableListOf<String>()

        for (i in 0 until actionsArray.length()) {
            val obj = actionsArray.optJSONObject(i) ?: continue
            actionIds.add(obj.optString("id", ""))
            actionTitles.add(obj.optString("title", ""))
        }

        activity.runOnUiThread {
            val builder = MaterialAlertDialogBuilder(activity)
                .setTitle(title)
                .setItems(actionTitles.toTypedArray()) { _, which ->
                    val selectedId = actionIds[which]
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("actionId", selectedId)
                    call.resolve(ret)
                }
                .setOnCancelListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }

            if (!message.isNullOrEmpty()) {
                builder.setMessage(message)
            }

            builder.show()
        }
    }

    @PluginMethod
    fun presentPrompt(call: PluginCall) {
        val title = call.getString("title", "") ?: ""
        val defaultValue = call.getString("defaultValue", "") ?: ""
        val placeholder = call.getString("placeholder", "") ?: ""
        val confirmLabel = call.getString("confirmLabel", "Valider") ?: "Valider"

        activity.runOnUiThread {
            val input = EditText(activity).apply {
                setText(defaultValue)
                hint = placeholder
            }
            val container = FrameLayout(activity).apply {
                val pad = (16 * activity.resources.displayMetrics.density).toInt()
                setPadding(pad, pad / 2, pad, pad / 2)
                addView(input)
            }

            MaterialAlertDialogBuilder(activity)
                .setTitle(title)
                .setView(container)
                .setPositiveButton(confirmLabel) { _, _ ->
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("value", input.text.toString())
                    call.resolve(ret)
                }
                .setNegativeButton("Annuler") { _, _ ->
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                .setOnCancelListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                .show()
        }
    }

    @PluginMethod
    fun presentChoices(call: PluginCall) {
        val title = call.getString("title", "") ?: ""
        val optionsArray = call.getArray("options")
        val selectedId = call.getString("selectedId")

        if (optionsArray == null || optionsArray.length() == 0) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
            return
        }

        val ids = mutableListOf<String>()
        val titles = mutableListOf<String>()
        var checkedIndex = -1

        for (i in 0 until optionsArray.length()) {
            val obj = optionsArray.optJSONObject(i) ?: continue
            val id = obj.optString("id", "")
            ids.add(id)
            titles.add(obj.optString("title", ""))
            if (id == selectedId) {
                checkedIndex = i
            }
        }

        activity.runOnUiThread {
            var tempSelected = checkedIndex
            MaterialAlertDialogBuilder(activity)
                .setTitle(title)
                .setSingleChoiceItems(titles.toTypedArray(), checkedIndex) { _, which ->
                    tempSelected = which
                }
                .setPositiveButton("OK") { _, _ ->
                    val ret = JSObject()
                    ret.put("active", true)
                    if (tempSelected in ids.indices) {
                        ret.put("value", ids[tempSelected])
                    }
                    call.resolve(ret)
                }
                .setNegativeButton("Annuler") { _, _ ->
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                .setOnCancelListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                .show()
        }
    }

    @PluginMethod
    fun presentDate(call: PluginCall) {
        val title = call.getString("title", "Choisir une date") ?: "Choisir une date"
        val value = call.getString("value", "") ?: ""

        activity.runOnUiThread {
            val fragmentActivity = activity as? FragmentActivity
            if (fragmentActivity == null) {
                val ret = JSObject()
                ret.put("active", false)
                call.resolve(ret)
                return@runOnUiThread
            }

            try {
                val builder = MaterialDatePicker.Builder.datePicker()
                    .setTitleText(title)

                if (value.isNotEmpty()) {
                    try {
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                        }
                        val parsed = sdf.parse(value)
                        if (parsed != null) {
                            builder.setSelection(parsed.time)
                        }
                    } catch (_: Exception) {}
                }

                val picker = builder.build()
                picker.addOnPositiveButtonClickListener { selection ->
                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    val formatted = sdf.format(Date(selection))
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("value", formatted)
                    call.resolve(ret)
                }
                picker.addOnNegativeButtonClickListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    // null value conveys cancellation
                    call.resolve(ret)
                }
                picker.addOnCancelListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                picker.show(fragmentActivity.supportFragmentManager, "LKDV_DATE_PICKER")
            } catch (e: Exception) {
                val ret = JSObject()
                ret.put("active", false)
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val url = call.getString("url", "") ?: ""
        val title = call.getString("title", "Partager")
        val text = call.getString("text")

        try {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, if (!text.isNullOrEmpty()) "$text\n$url" else url)
                type = "text/plain"
            }
            val shareIntent = Intent.createChooser(sendIntent, title)
            activity.startActivity(shareIntent)

            val ret = JSObject()
            ret.put("active", true)
            call.resolve(ret)
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun openBrowser(call: PluginCall) {
        val url = call.getString("url", "") ?: ""
        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.launchUrl(activity, Uri.parse(url))
            val ret = JSObject()
            ret.put("active", true)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun exportGPX(call: PluginCall) {
        val xml = call.getString("xml", "") ?: ""
        val fileName = call.getString("fileName", "trace.gpx") ?: "trace.gpx"

        try {
            val file = File(activity.cacheDir, fileName)
            FileOutputStream(file).use { out ->
                out.write(xml.toByteArray())
            }

            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file
            )

            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/gpx+xml"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(sendIntent, "Exporter la trace GPX")
            activity.startActivity(chooser)

            val ret = JSObject()
            ret.put("active", true)
            ret.put("saved", true)
            call.resolve(ret)
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            ret.put("saved", false)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("active", true)
            ret.put("saved", false)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun presentPhotos(call: PluginCall) {
        val maxCount = call.getInt("maxCount", 1) ?: 1
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                if (maxCount > 1) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            startActivityForResult(call, intent, "photosCallback")
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @ActivityCallback
    private fun photosCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            val ret = JSObject()
            ret.put("active", true)
            // Cancelled: photos is omitted/undefined in JSObject
            call.resolve(ret)
            return
        }

        val data = result.data
        val photos = JSArray()
        val ctx = context

        val clipData = data?.clipData
        if (clipData != null) {
            for (i in 0 until clipData.itemCount) {
                val uri = clipData.getItemAt(i).uri
                val photoObj = processImageUri(ctx, uri)
                if (photoObj != null) {
                    photos.put(photoObj)
                }
            }
        } else {
            val uri = data?.data
            if (uri != null) {
                val photoObj = processImageUri(ctx, uri)
                if (photoObj != null) {
                    photos.put(photoObj)
                }
            }
        }

        val ret = JSObject()
        ret.put("active", true)
        ret.put("photos", photos)
        call.resolve(ret)
    }

    @PluginMethod
    fun importGPX(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(
                    Intent.EXTRA_MIME_TYPES,
                    arrayOf("application/gpx+xml", "application/xml", "text/xml", "*/*")
                )
            }
            startActivityForResult(call, intent, "importGPXCallback")
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @ActivityCallback
    private fun importGPXCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            val ret = JSObject()
            ret.put("active", true)
            // Cancelled: text is omitted/undefined
            call.resolve(ret)
            return
        }

        val uri = result.data?.data
        if (uri == null) {
            val ret = JSObject()
            ret.put("active", true)
            call.resolve(ret)
            return
        }

        try {
            val content = context.contentResolver.openInputStream(uri)?.use { stream ->
                stream.bufferedReader().readText()
            }
            val ret = JSObject()
            ret.put("active", true)
            if (content != null) {
                ret.put("text", content)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    private fun processImageUri(ctx: Context, uri: Uri): JSObject? {
        return try {
            val mimeType = ctx.contentResolver.getType(uri) ?: "image/jpeg"
            val fileName = queryDisplayName(ctx, uri) ?: "photo.jpg"
            val bytes = ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: return null
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

            JSObject().apply {
                put("name", fileName)
                put("type", mimeType)
                put("data", base64)
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun queryDisplayName(ctx: Context, uri: Uri): String? {
        var name: String? = null
        if (uri.scheme == "content") {
            ctx.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        name = cursor.getString(index)
                    }
                }
            }
        }
        if (name == null) {
            name = uri.lastPathSegment
        }
        return name
    }

    @PluginMethod
    fun authenticateBiometric(call: PluginCall) {
        val title = call.getString("title", "Authentification biométrique") ?: "Authentification biométrique"
        val subtitle = call.getString("subtitle")
        val description = call.getString("reason") ?: call.getString("description")
        val negativeButtonText = call.getString("cancelLabel", "Annuler") ?: "Annuler"

        activity.runOnUiThread {
            val fragmentActivity = activity as? FragmentActivity
            if (fragmentActivity == null) {
                val ret = JSObject()
                ret.put("active", false)
                ret.put("success", false)
                ret.put("error", "L'activité hôte n'est pas une FragmentActivity")
                call.resolve(ret)
                return@runOnUiThread
            }

            val executor = ContextCompat.getMainExecutor(fragmentActivity)
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("success", true)
                    call.resolve(ret)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("success", false)
                    ret.put("errorCode", errorCode)
                    ret.put("error", errString.toString())
                    call.resolve(ret)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Rejet temporaire (ex. mauvaise empreinte). La boîte reste ouverte.
                }
            }

            try {
                val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setNegativeButtonText(negativeButtonText)

                if (!subtitle.isNullOrEmpty()) {
                    promptInfoBuilder.setSubtitle(subtitle)
                }
                if (!description.isNullOrEmpty()) {
                    promptInfoBuilder.setDescription(description)
                }

                val biometricPrompt = BiometricPrompt(fragmentActivity, executor, callback)
                biometricPrompt.authenticate(promptInfoBuilder.build())
            } catch (e: Exception) {
                val ret = JSObject()
                ret.put("active", false)
                ret.put("success", false)
                ret.put("error", e.localizedMessage ?: "Erreur d'initialisation biométrique")
                call.resolve(ret)
            }
        }
    }
}
