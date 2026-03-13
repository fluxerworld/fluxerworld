package org.fluxer.world

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.ServiceWorkerWebSettingsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var notificationId = 1000

    companion object {
        private const val APP_URL = "https://fluxer.world"
        private const val CHANNEL_ID = "fluxer_messages"
        private val ALLOWED_HOSTS = setOf("fluxer.world", "cdn.fluxer.world", "media.fluxer.world")

        // Keep WebView instance alive across activity recreation
        @SuppressLint("StaticFieldLeak")
        private var persistentWebView: WebView? = null
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

        createNotificationChannel()
        setupServiceWorker()

        val existing = persistentWebView
        if (existing != null) {
            // Reuse the existing WebView - just re-attach it
            (existing.parent as? android.view.ViewGroup)?.removeView(existing)
            webView = existing
            setContentView(webView)
        } else {
            webView = WebView(this)
            setContentView(webView)
            setupWebView()

            // Try to restore state from saved instance, otherwise load URL
            if (savedInstanceState != null) {
                webView.restoreState(savedInstanceState)
            } else {
                val startUrl = resolveIntentUrl(intent) ?: APP_URL
                webView.loadUrl(startUrl)
            }
            persistentWebView = webView
        }

        // Ask for notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                notificationPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Fluxer message notifications"
                enableVibration(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun setupServiceWorker() {
        // Enable service worker support for push notifications
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            val swController = ServiceWorkerControllerCompat.getInstance()
            swController.setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                    return null // let all service worker requests through
                }
            })
            if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_CACHE_MODE)) {
                swController.serviceWorkerWebSettings.cacheMode = WebSettings.LOAD_DEFAULT
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
                swController.serviceWorkerWebSettings.allowContentAccess = false
            }
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

        // Add JS bridge for native notifications
        webView.addJavascriptInterface(NotificationBridge(this), "FluxerAndroid")

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

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Inject notification override so the web app uses native Android notifications
                injectNotificationBridge()
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

    private fun injectNotificationBridge() {
        // Override the Notification API to use native Android notifications
        val js = """
            (function() {
                if (window._fluxerNotificationPatched) return;
                window._fluxerNotificationPatched = true;

                var OriginalNotification = window.Notification;

                var FluxerNotification = function(title, options) {
                    options = options || {};
                    try {
                        FluxerAndroid.showNotification(
                            title || '',
                            options.body || '',
                            options.icon || '',
                            (options.data && options.data.url) || ''
                        );
                    } catch(e) {}
                    this.close = function() {};
                };

                FluxerNotification.permission = 'granted';
                FluxerNotification.requestPermission = function(cb) {
                    if (cb) cb('granted');
                    return Promise.resolve('granted');
                };

                Object.defineProperty(window, 'Notification', {
                    value: FluxerNotification,
                    writable: true,
                    configurable: true
                });
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    @Suppress("unused")
    inner class NotificationBridge(private val context: Context) {
        @JavascriptInterface
        fun showNotification(title: String, body: String, icon: String, url: String) {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (url.isNotEmpty()) {
                    data = Uri.parse(url)
                }
            }
            val pendingIntent = PendingIntent.getActivity(
                context, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setDefaults(NotificationCompat.DEFAULT_ALL)

            try {
                NotificationManagerCompat.from(context).notify(notificationId++, builder.build())
            } catch (e: SecurityException) {
                // Notification permission not granted
            }
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
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
