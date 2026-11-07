package app.oto.browser

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.text.TextUtils
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.URLUtil
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.WebResponse
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/** One tab. The web engine session is only made when the tab is first shown (saves memory). */
class Tab(var url: String, var title: String = "") {
    var session: GeckoSession? = null
    var canBack = false
    var canForward = false
    var progress = 100
}

class MainActivity : AppCompatActivity() {
    companion object {
        const val NEWTAB = "resource://android/assets/newtab.html"
        private var runtime: GeckoRuntime? = null
        private var introPlayed = false

        // Oto theme
        const val BG = 0xFF0B0B0C.toInt()
        const val RAISE = 0xFF141416.toInt()
        const val LINE = 0x14FFFFFF
        const val LINE2 = 0x24FFFFFF
        const val FG = 0xFFECE8E1.toInt()
        const val FG2 = 0xA3ECE8E1.toInt()
        const val FG3 = 0x61ECE8E1
        const val CREAM = 0xFFE7DFD1.toInt()
        const val INK = 0xFF131313.toInt()
    }

    private val tabs = ArrayList<Tab>()
    private var cur = -1
    private lateinit var gecko: GeckoView
    private lateinit var root: FrameLayout
    private lateinit var bar: LinearLayout
    private lateinit var urlText: TextView
    private lateinit var urlEdit: EditText
    private lateinit var tabsBtn: TextView
    private lateinit var backBtn: TextView
    private lateinit var progressLine: View
    private var sheet: View? = null
    private val prefs by lazy { getSharedPreferences("oto", Context.MODE_PRIVATE) }
    private val dp get() = resources.displayMetrics.density
    private fun px(v: Int) = (v * dp).toInt()

    // ------------------------------------------------------------------ setup
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (runtime == null) runtime = GeckoRuntime.create(
            applicationContext,
            GeckoRuntimeSettings.Builder()
                .contentBlocking(shieldSettings(prefs.getBoolean("shield", true)))
                .consoleOutput(false)
                .build()
        )
        buildUi()
        restoreTabs()
        intent?.dataString?.let { if (it.startsWith("http")) openTab(it) }
        if (!introPlayed && savedInstanceState == null) playIntro()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = goBack()
        })
        thread { checkForUpdate(false) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { if (it.startsWith("http")) openTab(it) }
    }

    override fun onPause() { super.onPause(); saveTabs() }

    // Oto Shield = GeckoView's built-in blocking of ads, trackers, social trackers, fingerprinting and cryptominers
    private fun shieldSettings(on: Boolean): ContentBlocking.Settings =
        ContentBlocking.Settings.Builder()
            .antiTracking(if (on) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.NONE)
            .enhancedTrackingProtectionLevel(if (on) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.NONE)
            .build()

    private fun setShield(on: Boolean) {
        prefs.edit().putBoolean("shield", on).apply()
        runtime?.settings?.contentBlocking?.let {
            it.setAntiTracking(if (on) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.NONE)
            it.setEnhancedTrackingProtectionLevel(if (on) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.NONE)
        }
        current()?.session?.reload()
        toast(if (on) "Oto Shield is on — ads & trackers blocked" else "Oto Shield is off")
    }

    // ------------------------------------------------------------------ UI
    private fun box(bg: Int, stroke: Int = LINE2, radius: Int = 6) = GradientDrawable().apply {
        setColor(bg); cornerRadius = radius * dp; setStroke(maxOf(1, (1 * dp).toInt()), stroke)
    }

    private fun mono(text: String, size: Float = 10f, color: Int = FG3, spacing: Float = 0.18f) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(color); typeface = Typeface.MONOSPACE; letterSpacing = spacing
        isAllCaps = true; maxLines = 1; ellipsize = TextUtils.TruncateAt.END
    }

    private fun iconBtn(glyph: String, size: Float = 20f, onClick: () -> Unit) = TextView(this).apply {
        text = glyph; textSize = size; setTextColor(FG2); gravity = Gravity.CENTER
        layoutParams = LinearLayout.LayoutParams(px(42), px(42))
        setOnClickListener { onClick() }
        background = null
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildUi() {
        window.statusBarColor = BG
        window.navigationBarColor = BG
        root = FrameLayout(this).apply { setBackgroundColor(BG); fitsSystemWindows = true }

        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        gecko = GeckoView(this)
        column.addView(gecko, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        // thin cream progress line on top of the bar
        val progTrack = FrameLayout(this).apply { setBackgroundColor(LINE) }
        progressLine = View(this).apply { setBackgroundColor(CREAM); pivotX = 0f; scaleX = 0f }
        progTrack.addView(progressLine, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        column.addView(progTrack, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, maxOf(1, (1.5f * dp).toInt())))

        // bottom bar: back · address · tabs · menu
        bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(px(6), px(7), px(6), px(7)); setBackgroundColor(BG)
        }
        backBtn = iconBtn("←") { goBack() }
        bar.addView(backBtn)

        val pill = FrameLayout(this).apply { background = box(0x08FFFFFF) }
        val pillRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(px(12), 0, px(12), 0) }
        pillRow.addView(TextView(this).apply { text = "音"; textSize = 14f; setTextColor(FG); setPadding(0, 0, px(10), 0) })
        urlText = TextView(this).apply { textSize = 14f; setTextColor(FG2); maxLines = 1; ellipsize = TextUtils.TruncateAt.END; hint = "Search or enter address"; setHintTextColor(FG3) }
        pillRow.addView(urlText, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        pill.addView(pillRow, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        urlEdit = EditText(this).apply {
            visibility = View.GONE; textSize = 15f; setTextColor(FG); setHintTextColor(FG3); hint = "Search or enter address"
            background = null; setPadding(px(12), 0, px(12), 0); isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_GO; inputType = EditorInfo.TYPE_TEXT_VARIATION_URI or EditorInfo.TYPE_CLASS_TEXT
            setSelectAllOnFocus(true)
            setOnEditorActionListener { _, action, ev ->
                if (action == EditorInfo.IME_ACTION_GO || (ev != null && ev.keyCode == KeyEvent.KEYCODE_ENTER)) { navigate(text.toString()); true } else false
            }
            setOnFocusChangeListener { _, has -> if (!has) endEdit() }
        }
        pill.addView(urlEdit, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        pill.setOnClickListener { startEdit() }
        bar.addView(pill, LinearLayout.LayoutParams(0, px(42), 1f).apply { setMargins(px(4), 0, px(6), 0) })

        tabsBtn = TextView(this).apply {
            textSize = 11f; setTextColor(FG); typeface = Typeface.MONOSPACE; gravity = Gravity.CENTER
            background = box(0x00000000, FG2, 4); setOnClickListener { showTabs() }
        }
        bar.addView(tabsBtn, LinearLayout.LayoutParams(px(30), px(30)).apply { setMargins(px(6), 0, px(6), 0) })
        bar.addView(iconBtn("⋯", 22f) { showMenu() })

        column.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
    }

    private fun startEdit() {
        val t = current() ?: return
        urlEdit.setText(if (t.url == NEWTAB) "" else t.url)
        urlEdit.visibility = View.VISIBLE
        urlEdit.requestFocus()
        urlEdit.selectAll()
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(urlEdit, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun endEdit() {
        urlEdit.visibility = View.GONE
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(urlEdit.windowToken, 0)
    }

    private fun refreshBar() {
        val t = current()
        urlText.text = if (t == null || t.url == NEWTAB) "" else prettyUrl(t.url)
        tabsBtn.text = String.format("%02d", tabs.size).takeLast(2)
        backBtn.alpha = if (t?.canBack == true) 1f else 0.35f
        val p = t?.progress ?: 100
        progressLine.scaleX = if (p >= 100) 0f else p / 100f
    }

    private fun prettyUrl(u: String): String = try {
        val uri = Uri.parse(u); val host = (uri.host ?: u).removePrefix("www.")
        if (uri.scheme == "https" || uri.scheme == "http") host + (uri.path?.takeIf { it.length > 1 } ?: "") else u
    } catch (e: Exception) { u }

    // ------------------------------------------------------------------ tabs
    private fun current(): Tab? = tabs.getOrNull(cur)

    private fun newSession(): GeckoSession {
        val desktop = prefs.getBoolean("desktop", false)
        val s = GeckoSession(
            GeckoSessionSettings.Builder()
                .usePrivateMode(false)
                .userAgentMode(if (desktop) GeckoSessionSettings.USER_AGENT_MODE_DESKTOP else GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
                .viewportMode(if (desktop) GeckoSessionSettings.VIEWPORT_MODE_DESKTOP else GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
                .build()
        )
        s.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLocationChange(session: GeckoSession, url: String?, perms: MutableList<GeckoSession.PermissionDelegate.ContentPermission>, hasUserGesture: Boolean) {
                tabFor(session)?.let { it.url = url ?: it.url; if (it === current()) refreshBar() }
            }
            override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) { tabFor(session)?.canBack = canGoBack; refreshBar() }
            override fun onCanGoForward(session: GeckoSession, canGoForward: Boolean) { tabFor(session)?.canForward = canGoForward }
            override fun onNewSession(session: GeckoSession, uri: String): GeckoResult<GeckoSession>? {
                // a link that opens a new window: the engine opens this session itself, then we show it
                val ns = newSession()
                val idx = cur + 1
                tabs.add(idx, Tab(uri).also { it.session = ns })
                root.post { select(idx) }
                return GeckoResult.fromValue(ns)
            }
            override fun onLoadRequest(session: GeckoSession, request: GeckoSession.NavigationDelegate.LoadRequest): GeckoResult<AllowOrDeny>? {
                val scheme = Uri.parse(request.uri).scheme?.lowercase() ?: return null
                if (scheme in listOf("http", "https", "about", "data", "blob", "file", "resource", "javascript", "moz-extension")) return null
                // tel:, mailto:, intent:, app links → the right app
                return try {
                    val i = if (scheme == "intent") Intent.parseUri(request.uri, Intent.URI_INTENT_SCHEME) else Intent(Intent.ACTION_VIEW, Uri.parse(request.uri))
                    i.addCategory(Intent.CATEGORY_BROWSABLE); startActivity(i)
                    GeckoResult.fromValue(AllowOrDeny.DENY)
                } catch (e: Exception) { GeckoResult.fromValue(AllowOrDeny.DENY) }
            }
        }
        s.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onProgressChange(session: GeckoSession, progress: Int) { tabFor(session)?.progress = progress; if (tabFor(session) === current()) refreshBar() }
            override fun onPageStart(session: GeckoSession, url: String) { tabFor(session)?.progress = 5; refreshBar() }
            override fun onPageStop(session: GeckoSession, success: Boolean) { tabFor(session)?.progress = 100; refreshBar(); saveTabs() }
        }
        s.contentDelegate = object : GeckoSession.ContentDelegate {
            override fun onTitleChange(session: GeckoSession, title: String?) { tabFor(session)?.title = title ?: "" }
            override fun onFullScreen(session: GeckoSession, fullScreen: Boolean) {
                bar.visibility = if (fullScreen) View.GONE else View.VISIBLE
                (progressLine.parent as View).visibility = bar.visibility
            }
            override fun onExternalResponse(session: GeckoSession, response: WebResponse) { download(response.uri) }
            override fun onCrash(session: GeckoSession) { session.close(); tabFor(session)?.let { it.session = null; if (it === current()) select(cur) } }
            override fun onKill(session: GeckoSession) { tabFor(session)?.let { it.session = null; if (it === current()) select(cur) } }
        }
        return s
    }

    private fun tabFor(s: GeckoSession): Tab? = tabs.firstOrNull { it.session === s }

    private fun openTab(url: String = NEWTAB) {
        tabs.add(Tab(url))
        select(tabs.size - 1)
    }

    private fun select(i: Int) {
        if (tabs.isEmpty()) { openTab(); return }
        cur = i.coerceIn(0, tabs.size - 1)
        val t = tabs[cur]
        var s = t.session
        if (s == null) {
            s = newSession(); t.session = s
            s.open(runtime!!)
            s.loadUri(t.url)
        } else if (!s.isOpen) {
            s.open(runtime!!); s.loadUri(t.url)
        }
        gecko.releaseSession()
        gecko.setSession(s)
        refreshBar()
        saveTabs()
    }

    private fun closeTab(i: Int) {
        val t = tabs.getOrNull(i) ?: return
        if (i == cur) gecko.releaseSession()
        t.session?.close()
        tabs.removeAt(i)
        if (tabs.isEmpty()) { openTab(); return }
        if (i < cur || cur >= tabs.size) cur--
        select(cur.coerceAtLeast(0))
    }

    private fun navigate(text: String) {
        endEdit()
        val q = text.trim(); if (q.isEmpty()) return
        val url = when {
            Regex("^[a-z]+://", RegexOption.IGNORE_CASE).containsMatchIn(q) -> q
            !q.contains(' ') && Regex("^[^\\s]+\\.[a-z]{2,}(/|$|:|\\?)", RegexOption.IGNORE_CASE).containsMatchIn(q) -> "https://$q"
            else -> "https://duckduckgo.com/?q=" + Uri.encode(q)
        }
        val t = current() ?: return openTab(url)
        t.url = url
        t.session?.loadUri(url) ?: select(cur)
    }

    private fun goBack() {
        if (sheet != null) { closeSheet(); return }
        if (urlEdit.visibility == View.VISIBLE) { endEdit(); return }
        val t = current()
        if (t?.canBack == true) { t.session?.goBack(); return }
        if (tabs.size > 1 && t != null && t.url != NEWTAB) { closeTab(cur); return }
        moveTaskToBack(true)
    }

    private fun saveTabs() {
        val arr = JSONArray()
        tabs.forEach { arr.put(JSONObject().put("u", it.url).put("t", it.title)) }
        prefs.edit().putString("tabs", arr.toString()).putInt("cur", cur).apply()
    }

    private fun restoreTabs() {
        try {
            val arr = JSONArray(prefs.getString("tabs", "[]"))
            for (i in 0 until arr.length()) { val o = arr.getJSONObject(i); tabs.add(Tab(o.getString("u"), o.optString("t"))) }
        } catch (e: Exception) {}
        if (tabs.isEmpty()) tabs.add(Tab(NEWTAB))
        select(prefs.getInt("cur", 0))
    }

    // ------------------------------------------------------------------ sheets (tabs, menu, update)
    private fun closeSheet() { sheet?.let { root.removeView(it) }; sheet = null }

    private fun sheetFrame(content: View, fromBottom: Boolean = true): FrameLayout {
        closeSheet()
        val dim = FrameLayout(this).apply { setBackgroundColor(0xB3000000.toInt()); setOnClickListener { closeSheet() } }
        content.isClickable = true
        dim.addView(content, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, if (fromBottom) Gravity.BOTTOM else Gravity.TOP))
        root.addView(dim, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        content.translationY = 40 * dp; content.alpha = 0f
        content.animate().translationY(0f).alpha(1f).setDuration(220).start()
        sheet = dim
        return dim
    }

    /** "— 音 OTO // TABS ———— 03", like the sidebar labels on Windows */
    private fun label(left: String, right: String = ""): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        setPadding(px(4), px(4), px(4), px(12))
        addView(mono(left, 10f, FG2, 0.24f))
        addView(View(this@MainActivity).apply { setBackgroundColor(LINE2) }, LinearLayout.LayoutParams(0, maxOf(1, dp.toInt()), 1f).apply { setMargins(px(10), 0, px(10), 0) })
        if (right.isNotEmpty()) addView(mono(right, 10f, FG2, 0.2f))
    }

    private fun showTabs() {
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(14), px(18), px(14), px(14)); background = box(BG, LINE2, 10) }
        panel.addView(label("—  音  OTO // TABS", String.format("%02d", tabs.size)))
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        tabs.forEachIndexed { i, t ->
            val active = i == cur
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(px(10), px(10), px(4), px(10))
                background = if (active) box(CREAM, CREAM, 4) else box(0x05FFFFFF, LINE, 4)
                setOnClickListener { closeSheet(); select(i) }
            }
            row.addView(mono(String.format("%02d", i + 1), 10f, if (active) 0x80131313.toInt() else FG3, 0.05f).apply { setPadding(0, 0, px(12), 0) })
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            col.addView(TextView(this).apply {
                text = if (t.url == NEWTAB) "New Tab" else t.title.ifBlank { prettyUrl(t.url) }
                textSize = 14f; setTextColor(if (active) INK else FG); maxLines = 1; ellipsize = TextUtils.TruncateAt.END
                if (active) setTypeface(typeface, Typeface.BOLD)
            })
            if (t.url != NEWTAB) col.addView(mono(Uri.parse(t.url).host?.removePrefix("www.") ?: "", 9f, if (active) 0x99131313.toInt() else FG3, 0.12f).apply { isAllCaps = false })
            row.addView(col, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            row.addView(TextView(this).apply {
                text = "×"; textSize = 18f; setTextColor(if (active) INK else FG2); gravity = Gravity.CENTER
                setOnClickListener { closeTab(i); if (sheet != null) showTabs() }
            }, LinearLayout.LayoutParams(px(40), px(36)))
            list.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(0, 0, 0, px(6)) })
        }
        val scroll = ScrollView(this).apply { addView(list) }
        panel.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, minOf(px(64) * tabs.size + px(10), (resources.displayMetrics.heightPixels * 0.55).toInt())))
        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, px(10), 0, 0) }
        btns.addView(blockBtn("Close", false) { closeSheet() }, LinearLayout.LayoutParams(0, px(40), 1f).apply { setMargins(0, 0, px(6), 0) })
        btns.addView(blockBtn("+ New tab", true) { closeSheet(); openTab() }, LinearLayout.LayoutParams(0, px(40), 1f))
        panel.addView(btns)
        sheetFrame(panel)
    }

    private fun blockBtn(text: String, cream: Boolean, onClick: () -> Unit) = mono(text, 10f, if (cream) INK else FG2, 0.18f).apply {
        gravity = Gravity.CENTER
        background = if (cream) box(CREAM, CREAM, 4) else box(0x00000000, LINE2, 4)
        setOnClickListener { onClick() }
    }

    private fun showMenu() {
        val t = current()
        val shieldOn = prefs.getBoolean("shield", true)
        val soundOn = prefs.getBoolean("sound", true)
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(14), px(18), px(14), px(10)); background = box(BG, LINE2, 10) }
        panel.addView(label("—  音  OTO // MENU", "v" + BuildConfig.VERSION_NAME))
        fun row(name: String, value: String = "", action: () -> Unit) {
            val r = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(px(6), px(14), px(6), px(14))
                setOnClickListener { closeSheet(); action() }
            }
            r.addView(mono(name, 11f, FG, 0.18f), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            if (value.isNotEmpty()) r.addView(mono(value, 10f, if (value == "ON") CREAM else FG3, 0.2f))
            panel.addView(r)
            panel.addView(View(this).apply { setBackgroundColor(LINE) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, maxOf(1, dp.toInt())))
        }
        if (t?.canForward == true) row("Forward") { t.session?.goForward() }
        row("Reload") { t?.session?.reload() }
        row("New tab") { openTab() }
        if (t != null && t.url != NEWTAB) row("Share") {
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t.url), "Share"))
        }
        row("Oto Shield", if (shieldOn) "ON" else "OFF") { setShield(!shieldOn) }
        row("Desktop site", if (prefs.getBoolean("desktop", false)) "ON" else "OFF") { setDesktop(!prefs.getBoolean("desktop", false)) }
        row("Startup sound", if (soundOn) "ON" else "OFF") { prefs.edit().putBoolean("sound", !soundOn).apply() }
        row("Check for updates") { thread { checkForUpdate(true) } }
        row("Play the startup") { playIntro() }
        sheetFrame(panel)
    }

    private fun setDesktop(on: Boolean) {
        prefs.edit().putBoolean("desktop", on).apply()
        tabs.forEach { tab ->
            tab.session?.settings?.let {
                it.setUserAgentMode(if (on) GeckoSessionSettings.USER_AGENT_MODE_DESKTOP else GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
                it.setViewportMode(if (on) GeckoSessionSettings.VIEWPORT_MODE_DESKTOP else GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
            }
        }
        current()?.session?.reload()
    }

    // ------------------------------------------------------------------ startup animation + sound
    private fun playIntro() {
        introPlayed = true
        var intro: IntroView? = null
        intro = IntroView(this) { intro?.let { root.removeView(it) } }
        root.addView(intro, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        if (prefs.getBoolean("sound", true)) {
            try {
                MediaPlayer.create(this, R.raw.start)?.apply { setVolume(0.6f, 0.6f); setOnCompletionListener { it.release() }; start() }
            } catch (e: Exception) {}
        }
    }

    // ------------------------------------------------------------------ downloads
    private fun download(url: String) {
        try {
            val name = URLUtil.guessFileName(url, null, null)
            val req = DownloadManager.Request(Uri.parse(url))
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                .setTitle(name)
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            toast("Downloading $name")
        } catch (e: Exception) { toast("Couldn’t download that file") }
    }

    // ------------------------------------------------------------------ updates (GitHub pre-releases "android-v…")
    private fun checkForUpdate(manual: Boolean) {
        try {
            val c = URL("https://api.github.com/repos/mukairyo/oto/releases?per_page=20").openConnection() as HttpURLConnection
            c.setRequestProperty("Accept", "application/vnd.github+json")
            c.connectTimeout = 8000; c.readTimeout = 8000
            val arr = JSONArray(c.inputStream.bufferedReader().readText())
            var best: JSONObject? = null; var bestV = BuildConfig.VERSION_NAME
            for (i in 0 until arr.length()) {
                val r = arr.getJSONObject(i); val tag = r.optString("tag_name")
                if (!tag.startsWith("android-v")) continue
                val v = tag.removePrefix("android-v")
                if (newer(v, bestV)) { best = r; bestV = v }
            }
            val apk = best?.optJSONArray("assets")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) }.firstOrNull { it.optString("name").endsWith(".apk") } }
            runOnUiThread {
                if (best != null && apk != null) showUpdate(bestV, apk.getString("browser_download_url"))
                else if (manual) toast("Oto for Android is up to date (v${BuildConfig.VERSION_NAME})")
            }
        } catch (e: Exception) { if (manual) runOnUiThread { toast("Couldn’t check for updates") } }
    }

    private fun newer(a: String, b: String): Boolean {
        val x = a.split('.').map { it.toIntOrNull() ?: 0 }; val y = b.split('.').map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(x.size, y.size)) { val d = (x.getOrElse(i) { 0 }) - (y.getOrElse(i) { 0 }); if (d != 0) return d > 0 }
        return false
    }

    /** Update card in the sidebar style: "UPDATE ——— ● READY", a box with the version, LATER / DOWNLOAD */
    private fun showUpdate(version: String, apkUrl: String) {
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(14), px(18), px(14), px(14)); background = box(BG, LINE2, 10) }
        panel.addView(label("UPDATE", "●  READY"))
        val b = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(12), px(12), px(12), px(12)); background = box(0x05FFFFFF, LINE2, 6) }
        b.addView(TextView(this).apply { text = "OTO ANDROID $version"; textSize = 12f; setTextColor(FG); letterSpacing = 0.16f; setTypeface(Typeface.DEFAULT, Typeface.BOLD) })
        b.addView(mono("Download, then tap to install", 9f, FG3, 0.16f).apply { setPadding(0, px(6), 0, 0) })
        panel.addView(b)
        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, px(8), 0, 0) }
        btns.addView(blockBtn("Later", false) { closeSheet() }, LinearLayout.LayoutParams(0, px(40), 1f).apply { setMargins(0, 0, px(6), 0) })
        btns.addView(blockBtn("Download", true) { closeSheet(); download(apkUrl) }, LinearLayout.LayoutParams(0, px(40), 1f))
        panel.addView(btns)
        sheetFrame(panel)
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
