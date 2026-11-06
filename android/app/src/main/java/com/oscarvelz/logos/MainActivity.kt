package com.oscarvelz.logos

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Logos for Android: a thin shell around the Logos web app, loaded live from GitHub Pages so every web update
 * arrives by itself. Everything Logos keeps (the voice models, books, saved audio, settings) lives in this
 * app's own private WebView storage, so clearing Chrome's site data no longer touches it, and clearing this
 * app's data touches only Logos.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private val home = "https://oscarvelz.github.io/Logos/"
    private val bg = Color.parseColor("#0A0A0F")
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private val crashes = ArrayList<Long>()
    /** Files shared into Logos, waiting for the page to read them. */
    private var shared: List<Uri> = emptyList()
    /** Files the page is saving to Download/Logos, by name. */
    private val saving = HashMap<String, Uri>()

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.setDecorFitsSystemWindows(false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.isNavigationBarContrastEnforced = false
        window.isStatusBarContrastEnforced = false
        WebView.setWebContentsDebuggingEnabled(true)
        root = FrameLayout(this)
        root.setBackgroundColor(bg)
        web = makeWeb()
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            val ime = insets.getInsets(WindowInsets.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsets.CONSUMED
        }
        setContentView(root)
        window.decorView.setBackgroundColor(bg)
        PlaybackService.onAction = { a -> runOnUiThread { web.evaluateJavascript("dispatchEvent(new Event('logosandroid-$a'))", null) } }
        val target = shareUrl(intent)
        when {
            target != null -> web.loadUrl(target)
            state != null -> web.restoreState(state)
            else -> web.loadUrl(home)
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 5)
        checkUpdate()
    }

    private fun makeWeb(): WebView {
        val w = WebView(this)
        w.setBackgroundColor(bg)
        // Keep the page working at full speed while it reads with the screen off.
        w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        w.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false; allowFileAccess = false; allowContentAccess = true
            textZoom = 100
            userAgentString = "$userAgentString LogosAndroid/${BuildConfig.VERSION_NAME}"
        }
        ServiceWorkerController.getInstance().serviceWorkerWebSettings.apply {
            cacheMode = WebSettings.LOAD_DEFAULT; allowContentAccess = true; allowFileAccess = false
        }
        w.addJavascriptInterface(Bridge(), "LogosAndroid")
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                val u = r.url
                if (u.host == "oscarvelz.github.io" && (u.path ?: "").startsWith("/Logos")) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }; return true
            }
            override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
                if (!r.isForMainFrame) return
                v.loadDataWithBaseURL(home, "<html><body style=\"background:#0A0A0F;color:#eee;font:18px sans-serif;padding:32px\">" +
                    "<p>Logos needs the internet the first time it opens. After that it works offline.</p>" +
                    "<p><a style=\"color:#e9bd72\" href=\"$home\">Try again</a></p></body></html>", "text/html", "utf-8", null)
            }
            override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean { recoverWeb(v); return true }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                val accept = p.acceptTypes.flatMap { it.split(',') }.map { it.trim() }.filter { it.isNotEmpty() }
                val mimes = accept.filter { it.contains('/') }
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                // Book lists name extensions (.epub, .fb2…) that phones label differently, so show every file then.
                if (accept.isNotEmpty() && mimes.size == accept.size) {
                    intent.type = if (mimes.size == 1) mimes[0] else "*/*"
                    if (mimes.size > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
                } else intent.type = "*/*"
                if (p.mode == FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                return try { startActivityForResult(intent, 7); true } catch (e: Exception) { fileCb = null; false }
            }
        }
        return w
    }

    private fun recoverWeb(dead: WebView) {
        if (dead !== web) { runCatching { root.removeView(dead); dead.destroy() }; return }
        root.removeView(dead); runCatching { dead.destroy() }
        val now = SystemClock.elapsedRealtime()
        crashes.add(now); crashes.removeAll { now - it > 60_000 }
        web = makeWeb()
        root.addView(web, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        if (crashes.size >= 3) {
            web.loadDataWithBaseURL(home, "<html><body style=\"background:#0A0A0F;color:#eee;font:18px sans-serif;padding:32px\">" +
                "<p>Logos had to reopen several times in a minute, so it is waiting here.</p>" +
                "<p><a style=\"color:#e9bd72\" href=\"$home\">Open Logos</a></p></body></html>", "text/html", "utf-8", null)
        } else {
            web.loadUrl(home)
            Toast.makeText(this, "Logos reopened after its page stopped.", Toast.LENGTH_SHORT).show()
        }
    }

    /** The page to open for a share or an "Open with": shared text plays on Listen, files go to Books. */
    private fun shareUrl(i: Intent?): String? {
        if (i == null) return null
        val uris = ArrayList<Uri>()
        when (i.action) {
            Intent.ACTION_VIEW -> i.data?.let { uris.add(it) }
            Intent.ACTION_SEND -> @Suppress("DEPRECATION") (i.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))?.let { uris.add(it) }
            Intent.ACTION_SEND_MULTIPLE -> @Suppress("DEPRECATION") i.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
            else -> return null
        }
        if (uris.isNotEmpty()) {
            shared = uris
            return "$home?sharedfiles=${uris.size}#/library"
        }
        val text = i.getStringExtra(Intent.EXTRA_TEXT) ?: return null
        val title = i.getStringExtra(Intent.EXTRA_SUBJECT) ?: ""
        fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
        return "$home?title=${enc(title)}&text=${enc(text)}"
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == "logos.INSTALL") { installResult(intent); return }
        shareUrl(intent)?.let { web.loadUrl(it) }
    }

    private fun nameOf(u: Uri): Pair<String, Long> {
        var name = u.lastPathSegment?.substringAfterLast('/') ?: "book"
        var size = -1L
        runCatching {
            contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) { c.getString(0)?.let { name = it }; if (!c.isNull(1)) size = c.getLong(1) }
            }
        }
        return name to size
    }

    inner class Bridge {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface fun sharedList(): String {
            val a = JSONArray()
            for (u in shared) {
                val (name, size) = nameOf(u)
                a.put(JSONObject().put("name", name).put("type", contentResolver.getType(u) ?: "").put("size", size))
            }
            return a.toString()
        }
        @JavascriptInterface fun sharedChunk(i: Int, offset: Double, length: Int): String {
            val u = shared.getOrNull(i) ?: return ""
            return runCatching {
                contentResolver.openInputStream(u)?.use { inp ->
                    var skip = offset.toLong()
                    while (skip > 0) { val n = inp.skip(skip); if (n <= 0) break; skip -= n }
                    val buf = ByteArray(length)
                    var got = 0
                    while (got < length) { val n = inp.read(buf, got, length - got); if (n < 0) break; got += n }
                    if (got == 0) "" else Base64.encodeToString(buf, 0, got, Base64.NO_WRAP)
                } ?: ""
            }.getOrDefault("")
        }
        @JavascriptInterface fun sharedDone() { shared = emptyList() }

        /** Audio and text files the page saves land in Download/Logos. */
        @JavascriptInterface fun saveChunk(name: String, b64: String, first: Boolean): String = runCatching {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val safe = name.replace(Regex("[/\\\\:*?\"<>|]"), "-").ifBlank { "logos" }
            var u = saving[safe]
            if (first || u == null) {
                val v = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, safe)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Logos/")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                u = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: throw IllegalStateException("no file")
                saving[safe] = u
                contentResolver.openOutputStream(u, "wt")!!.use { it.write(bytes) }
            } else contentResolver.openOutputStream(u, "wa")!!.use { it.write(bytes) }
            "ok"
        }.getOrElse { it.message ?: "error" }

        @JavascriptInterface fun saveDone(name: String, mime: String, share: Boolean) {
            val safe = name.replace(Regex("[/\\\\:*?\"<>|]"), "-").ifBlank { "logos" }
            val u = saving.remove(safe) ?: return
            runCatching { contentResolver.update(u, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) }
            runOnUiThread {
                if (share) {
                    val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    runCatching { startActivity(Intent.createChooser(send, safe)) }
                } else Toast.makeText(this@MainActivity, "Saved to Download/Logos", Toast.LENGTH_SHORT).show()
            }
        }

        /** Playback state for the media notification and lock screen. */
        @JavascriptInterface fun playing(on: Boolean, title: String, text: String) {
            val i = Intent(this@MainActivity, PlaybackService::class.java).putExtra("playing", on).putExtra("title", title).putExtra("text", text)
            runOnUiThread {
                runCatching { startForegroundService(i) }
            }
        }
    }

    /** The app updates itself: if GitHub has a newer android-N build, offer it and install it in place. */
    private fun checkUpdate() = Thread {
        try {
            val c = URL("https://api.github.com/repos/Oscarvelz/Logos/releases?per_page=30").openConnection() as HttpURLConnection
            c.setRequestProperty("Accept", "application/vnd.github+json"); c.connectTimeout = 8000; c.readTimeout = 8000
            val list = JSONArray(c.inputStream.bufferedReader().readText())
            var best = BuildConfig.VERSION_CODE
            var url: String? = null
            for (i in 0 until list.length()) {
                val r = list.getJSONObject(i)
                val n = r.getString("tag_name").takeIf { it.startsWith("android-") }?.substringAfter("android-")?.toIntOrNull() ?: continue
                if (n <= best) continue
                val assets = r.getJSONArray("assets")
                val apk = (0 until assets.length()).map { assets.getJSONObject(it) }.firstOrNull { it.getString("name").endsWith(".apk") } ?: continue
                best = n; url = apk.getString("browser_download_url")
            }
            val found = url ?: return@Thread
            runOnUiThread {
                AlertDialog.Builder(this).setTitle("Logos update ready")
                    .setMessage("A newer Logos app is ready. Install it now? Your voices, books and saved audio stay as they are.")
                    .setPositiveButton("Install") { _, _ -> install(found) }.setNegativeButton("Later", null).show()
            }
        } catch (_: Exception) {}
    }.start()

    private fun install(url: String) {
        Toast.makeText(this, "Downloading the update…", Toast.LENGTH_SHORT).show()
        Thread {
            try {
                val pi = packageManager.packageInstaller
                val id = pi.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL))
                pi.openSession(id).use { s ->
                    val c = URL(url).openConnection() as HttpURLConnection; c.instanceFollowRedirects = true
                    c.inputStream.use { inp -> s.openWrite("logos.apk", 0, -1).use { out -> inp.copyTo(out); s.fsync(out) } }
                    val back = Intent(this, MainActivity::class.java).setAction("logos.INSTALL")
                    val pend = PendingIntent.getActivity(this, 1, back, PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
                    s.commit(pend.intentSender)
                }
            } catch (e: Exception) { runOnUiThread { Toast.makeText(this, "Update failed: ${e.message}", Toast.LENGTH_LONG).show() } }
        }.start()
    }

    private fun installResult(intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirm != null) startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> Toast.makeText(this, "Update didn’t install: " + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""), Toast.LENGTH_LONG).show()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(rq: Int, rc: Int, d: Intent?) {
        if (rq != 7) { super.onActivityResult(rq, rc, d); return }
        val cd = d?.clipData
        val res: Array<Uri>? = if (rc != RESULT_OK) null
            else if (cd != null) Array(cd.itemCount) { cd.getItemAt(it).uri }
            else d?.data?.let { arrayOf(it) }
        fileCb?.onReceiveValue(res); fileCb = null
    }

    override fun onPause() { super.onPause(); CookieManager.getInstance().flush() }

    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); web.saveState(out) }

    private var lastBack = 0L
    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (web.canGoBack()) { web.goBack(); return }
        val now = System.currentTimeMillis()
        if (now - lastBack < 2000) moveTaskToBack(true)
        else { lastBack = now; Toast.makeText(this, "Press back again to leave Logos", Toast.LENGTH_SHORT).show() }
    }

    override fun onDestroy() {
        PlaybackService.onAction = null
        runCatching { startService(Intent(this, PlaybackService::class.java).setAction("stop")) }
        super.onDestroy()
    }
}
