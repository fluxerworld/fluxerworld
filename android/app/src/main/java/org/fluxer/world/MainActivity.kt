package org.fluxer.world

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    companion object {
        private const val APP_URL = "https://fluxer.world"
        private val ALLOWED_HOSTS = setOf("fluxer.world", "cdn.fluxer.world", "media.fluxer.world")
    }

    // File chooser launcher
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        filePathCallback?.onReceiveValue(uris.toTypedArray())
        filePathCallback = null
    }

    // Notification permission launcher (Android 13+)
    private val notificationPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* user responded; WebView will retry if needed */ }

    // Media permission launcher
    private val mediaPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* handled in permission request handler */ }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        setupWebView()

        // Ask for notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                notificationPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Handle deep link or load default URL
        val startUrl = resolveIntentUrl(intent) ?: APP_URL
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(startUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Force dark mode to follow system if supported
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)
        }

        // Cache
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url ?: return false
                return if (isAllowedUrl(url.toString())) {
                    false // let WebView handle it
                } else {
                    openExternal(url.toString())
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {

            // File chooser
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                try {
                    fileChooserLauncher.launch("*/*")
                } catch (e: Exception) {
                    filePathCallback = null
                    return false
                }
                return true
            }

            // Geolocation (denied)
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                callback.invoke(origin, false, false)
            }

            // Permission requests from JS (camera, mic, notifications)
            override fun onPermissionRequest(request: PermissionRequest) {
                val toGrant = mutableListOf<String>()
                for (resource in request.resources) {
                    when (resource) {
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED) {
                                toGrant.add(resource)
                            } else {
                                mediaPermLauncher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
                            }
                        }
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED) {
                                toGrant.add(resource)
                            } else {
                                mediaPermLauncher.launch(arrayOf(Manifest.permission.CAMERA))
                            }
                        }
                    }
                }
                if (toGrant.isNotEmpty()) {
                    request.grant(toGrant.toTypedArray())
                } else {
                    request.deny()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val url = resolveIntentUrl(intent)
        if (url != null) {
            webView.loadUrl(url)
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private fun isAllowedUrl(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            uri.scheme == "https" && ALLOWED_HOSTS.contains(uri.host)
        } catch (e: Exception) {
            false
        }
    }

    private fun resolveIntentUrl(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        return when {
            uri.scheme == "fluxerworld" -> {
                // fluxerworld://path/sub?q=1 → https://fluxer.world/path/sub?q=1
                val path = (uri.host ?: "") + (uri.path ?: "")
                val query = if (uri.query != null) "?${uri.query}" else ""
                val fragment = if (uri.fragment != null) "#${uri.fragment}" else ""
                "$APP_URL/${path.trimStart('/')}$query$fragment"
            }
            uri.scheme == "https" && ALLOWED_HOSTS.contains(uri.host) -> uri.toString()
            else -> null
        }
    }

    private fun openExternal(url: String) {
        try {
            val i = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(i)
        } catch (e: Exception) {
            Toast.makeText(this, "Could not open link", Toast.LENGTH_SHORT).show()
        }
    }
}
