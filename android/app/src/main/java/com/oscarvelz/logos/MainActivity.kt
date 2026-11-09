package com.oscarvelz.logos

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Bundle
import android.os.SystemClock
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Base64
import android.view.ViewGroup
import android.view.WindowManager
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
    // The ghost visit (1.4.88, Oscar): the watches used to bring Logos
    // forward to unfreeze its page — which dragged him INTO the app when
    // all he wanted was the bubble to do its work. Now a wake arrives as
    // a ghost: this activity resumes transparent and touch-through, the
    // page breathes and finishes its render, and the visit leaves on its
    // own the moment the state says sound is flowing. He never lands here.
    private var ghost = false
    private var ghostLeaving = false
    private var ghostSeq = 0
    private var intentDriven = false
    private var resumed = false
    private var ghostBegan = 0L
    private val ghostHandler = Handler(Looper.getMainLooper())
    private val ghostLeave = Runnable { leaveGhost() }
    private val crashes = ArrayList<Long>()
    /** Files shared into Logos, waiting for the page to read them. */
    private var shared: List<Uri> = emptyList()
    /** Files the page is saving to Download/Logos, by name. */
    private val saving = HashMap<String, Uri>()

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        intentDriven = true
        if (intent?.getBooleanExtra("logos.ghost", false) == true) enterGhost()
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
        if (ghost) { web.alpha = 0f; root.setBackgroundColor(Color.TRANSPARENT); window.decorView.setBackgroundColor(Color.TRANSPARENT) }
        PlaybackService.onAction = { a -> runOnUiThread { web.evaluateJavascript("dispatchEvent(new Event('logosandroid-$a'))", null) } }
        // The floating bubble speaks to the page through the same event door.
        BubbleService.poke = { cmd ->
            runOnUiThread {
                // 'reload' is the shell's last rung, not a page event: the
                // page is the corpse, so the activity revives it natively.
                if (cmd == "reload") web.reload()
                else web.evaluateJavascript("dispatchEvent(new Event('logosandroid-$cmd'))", null)
            }
        }
        // If Oscar left the bubble on, it comes back with the app (e.g. after an update).
        if (BubbleService.prefs(this).getBoolean("on", false) && !BubbleService.running && Settings.canDrawOverlays(this))
            runCatching { startForegroundService(Intent(this, BubbleService::class.java)) }
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
                "<p><a style=\"color:#e9bd72\" href=\"$home\">${BubbleService.s("Open Logos", "Abrir Logos")}</a></p></body></html>", "text/html", "utf-8", null)
        } else {
            web.loadUrl(home)
            Toast.makeText(this, BubbleService.s("Logos reopened after its page stopped.", "Logos se reabrió tras detenerse su página."), Toast.LENGTH_SHORT).show()
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
        intentDriven = true
        if (intent.getBooleanExtra("logos.ghost", false)) { if (!resumed && !ghost) enterGhost() }
        else if (ghost) exitGhost()
        if (BubbleService.wantReload) { BubbleService.wantReload = false; web.reload() }
        if (intent.action == "logos.INSTALL") { installResult(intent); return }
        shareUrl(intent)?.let { web.loadUrl(it) }
    }

    override fun onResume() {
        super.onResume()
        bringWebHome()
        resumed = true
        // Back without any intent behind it — he opened the task himself
        // (Recents, a notification): a visit still wearing its ghost
        // clothes simply becomes his stay.
        if (ghost && !intentDriven) exitGhost()
        intentDriven = false
        if (BubbleService.wantReload) { BubbleService.wantReload = false; web.reload() }
    }

    private fun enterGhost() {
        ghost = true
        ghostSeq++
        ghostLeaving = false
        ghostBegan = System.currentTimeMillis()
        window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)
        if (::web.isInitialized) { web.alpha = 0f; root.setBackgroundColor(Color.TRANSPARENT); window.decorView.setBackgroundColor(Color.TRANSPARENT) }
        overridePendingTransition(0, 0)
        ghostHandler.removeCallbacks(ghostLeave)
        ghostHandler.postDelayed(ghostLeave, 25_000)
    }

    /** A real arrival (his tap on the icon, a share) while a visit is on:
     *  the visit simply becomes his stay — screen back, flags off. */
    private fun exitGhost() {
        ghost = false
        ghostHandler.removeCallbacks(ghostLeave)
        unGhost()
    }

    private fun unGhost() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)
        if (::web.isInitialized) { web.alpha = 1f; root.setBackgroundColor(bg); window.decorView.setBackgroundColor(bg) }
    }

    private fun leaveGhost() {
        if (!ghost) return
        ghost = false
        ghostHandler.removeCallbacks(ghostLeave)
        // To the BACK, never finish() (1.4.89): finishing destroys the
        // only activity there is — and the WebView with it — so the page
        // the visit just revived would die as the visit leaves, and the
        // playback with it. To the back, the activity merely stops:
        // page alive, session alive, his app in front again.
        moveTaskToBack(true)
        overridePendingTransition(0, 0)
        val seq = ghostSeq
        ghostHandler.postDelayed({ if (seq == ghostSeq && !ghost) unGhost() }, 350)
    }

    /** Every state push lands here during a visit: sound flowing — or
     *  nothing coming after a fair wait — means the errand is done. */
    private fun ghostPulse() {
        if (!ghost || ghostLeaving) return
        val raw = BubbleService.nowJson ?: return
        val j = runCatching { JSONObject(raw) }.getOrNull() ?: return
        val playing = j.optBoolean("playing")
        val busy = j.optBoolean("busy")
        if (playing || (!busy && System.currentTimeMillis() - ghostBegan > 3_000)) {
            ghostLeaving = true
            ghostHandler.removeCallbacks(ghostLeave)
            ghostHandler.postDelayed(ghostLeave, 400)
        }
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

        /** WebView can't grant clipboard-read, so Paste reads the system clipboard here. */
        @JavascriptInterface fun clipboard(): String = runCatching {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            val clip = cm.primaryClip ?: return@runCatching ""
            buildString { for (i in 0 until clip.itemCount) { val t = clip.getItemAt(i).coerceToText(this@MainActivity)?.toString().orEmpty(); if (t.isNotEmpty()) { if (isNotEmpty()) append('\n'); append(t) } } }
        }.getOrDefault("")

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
                } else Toast.makeText(this@MainActivity, BubbleService.s("Saved to Download/Logos", "Guardado en Download/Logos"), Toast.LENGTH_SHORT).show()
            }
        }

        /** Playback state for the media notification and lock screen. */
        @JavascriptInterface fun playing(on: Boolean, title: String, text: String) {
            val i = Intent(this@MainActivity, PlaybackService::class.java).putExtra("playing", on).putExtra("title", title).putExtra("text", text)
            runOnUiThread {
                runCatching { startForegroundService(i) }
            }
        }

        /** Shell 17: the same state with the book's title and the artist line kept apart, so the
         *  media card can head with the book (and wear the bundled artwork) instead of scrolling
         *  the current sentence. Older pages keep using playing() above. */
        @JavascriptInterface fun media(on: Boolean, book: String, artist: String, text: String) {
            val i = Intent(this@MainActivity, PlaybackService::class.java).putExtra("playing", on).putExtra("book", book).putExtra("artist", artist).putExtra("text", text)
            runOnUiThread {
                runCatching { startForegroundService(i) }
            }
        }

        // ── The floating bubble (shell android-18) ──────────────────────────
        /** The bubble's native truth for the Settings card: permission + service + the last clipboard try. */
        @JavascriptInterface fun bubbleState(): String =
            JSONObject().put("permission", Settings.canDrawOverlays(this@MainActivity)).put("running", BubbleService.running)
                .put("last", BubbleService.prefs(this@MainActivity).getString("lastTry", "") ?: "").toString()

        /** Paste & play asked by hand and the bubble could not read: the page reads it itself as Logos opens. */
        @JavascriptInterface fun bubbleWantClip(): Boolean {
            val w = BubbleService.wantClip
            BubbleService.wantClip = false
            return w
        }

        /** The stage lock, so the page's own automatic reads honour it too. */
        @JavascriptInterface fun bubbleLock(): Boolean = BubbleService.isLocked(this@MainActivity)

        /** A transport press that arrived while the page was asleep, pulled once as it wakes. */
        @JavascriptInterface fun bubblePendingCmd(): String {
            val c = BubbleService.pendingCmd
            BubbleService.pendingCmd = null
            return c ?: ""
        }

        /** The panel's seek bar: the chosen fraction, pulled once by the page. */
        @JavascriptInterface fun bubbleSeek(): String {
            val f = BubbleService.seekFrac
            BubbleService.seekFrac = -1.0
            return if (f >= 0) f.toString() else ""
        }

        @JavascriptInterface fun bubble(on: Boolean) {
            BubbleService.prefs(this@MainActivity).edit().putBoolean("on", on).apply()
            runOnUiThread {
                val i = Intent(this@MainActivity, BubbleService::class.java)
                if (on) runCatching { startForegroundService(i) }
                else startService(i.setAction("hide"))
            }
        }

        @JavascriptInterface fun bubblePermission() {
            runOnUiThread {
                runCatching { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))) }
            }
        }

        /** The lever, kept natively too: the bubble must know it even with the page asleep. */
        @JavascriptInterface fun bubblePrefs(auto: Boolean) {
            BubbleService.prefs(this@MainActivity).edit().putBoolean("auto", auto).apply()
        }
        @JavascriptInterface fun bubbleAuto(): Boolean = BubbleService.lever(this@MainActivity)

        /** Player state for the bubble's panel (title, sentence, play state). */
        @JavascriptInterface fun bubbleNow(json: String) {
            BubbleService.nowJson = json
            BubbleService.nowAt = System.currentTimeMillis()
            BubbleService.syncWakeLock(this@MainActivity)
            BubbleService.onNow?.invoke()
            ghostPulse()
        }

        /** The clipboard text the bubble caught, pulled once by the page. */
        @JavascriptInterface fun bubbleClip(): String {
            val t = BubbleService.clipText ?: return ""
            val m = BubbleService.clipManual
            BubbleService.clipText = null
            return JSONObject().put("t", t).put("m", m).toString()
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
        Toast.makeText(this, BubbleService.s("Downloading the update…", "Descargando la actualización…"), Toast.LENGTH_SHORT).show()
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
            } catch (e: Exception) { runOnUiThread { Toast.makeText(this, BubbleService.s("Update failed: ", "La actualización falló: ") + e.message, Toast.LENGTH_LONG).show() } }
        }.start()
    }

    private fun installResult(intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirm != null) startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> Toast.makeText(this, BubbleService.s("Update didn’t install: ", "La actualización no se instaló: ") + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""), Toast.LENGTH_LONG).show()
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

    override fun onPause() { super.onPause(); resumed = false; CookieManager.getInstance().flush() }

    /** Leaving Logos — often on the way to copy something: the bubble waves once,
     *  "I'm here when you're ready." (Android lets no app watch the clipboard
     *  from the background; this is the true moment nearest to the copy.) */
    override fun onStop() {
        super.onStop()
        runCatching { BubbleService.inviteHook?.invoke() }
        // The backstage (1.4.111): with the bubble on, the page keeps working
        // out of sight in an invisible overlay instead of sleeping here.
        if (!isChangingConfigurations && !isFinishing && BubbleService.running && web.width > 0)
            Backstage.adopt(this, web, web.width, web.height)
    }

    override fun onStart() {
        super.onStart()
        bringWebHome()
    }

    /** Take the WebView back from the backstage before the activity draws. */
    private fun bringWebHome() {
        if (web.parent === root) return
        Backstage.release()
        (web.parent as? ViewGroup)?.removeView(web)
        root.addView(web, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); web.saveState(out) }

    private var lastBack = 0L
    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (web.canGoBack()) { web.goBack(); return }
        val now = System.currentTimeMillis()
        if (now - lastBack < 2000) moveTaskToBack(true)
        else { lastBack = now; Toast.makeText(this, BubbleService.s("Press back again to leave Logos", "Pulsa atrás otra vez para salir de Logos"), Toast.LENGTH_SHORT).show() }
    }

    override fun onDestroy() {
        // While the bubble lives, the backstage and the poke are the
        // service's to keep (1.4.112): an activity the system reclaims
        // while Logos sits in the background must not tear down the page
        // it merely hosted — that quiet teardown was one way the
        // backstage vanished between one copy and the next. The next
        // activity instance replaces both when it is created; the
        // service's own onDestroy releases the backstage for good.
        if (!BubbleService.running) {
            Backstage.release()
            BubbleService.poke = null
        }
        PlaybackService.onAction = null
        runCatching { startService(Intent(this, PlaybackService::class.java).setAction("stop")) }
        super.onDestroy()
    }
}
