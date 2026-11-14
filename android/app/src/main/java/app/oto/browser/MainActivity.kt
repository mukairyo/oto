package app.oto.browser

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.text.InputType
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
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
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
import org.mozilla.geckoview.MediaSession
import org.mozilla.geckoview.WebExtension
import org.mozilla.geckoview.WebExtensionController
import org.mozilla.geckoview.WebRequestError
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
    /** the dangerous page Oto just stopped in this tab (only that one can be opened with "Continue anyway") */
    var blocked: String? = null
    /** opened in the background and not looked at yet: its video waits until you open the tab */
    var unseen = false
    /** media Oto paused because the tab hadn't been opened yet (started when you open it) */
    var heldMedia: MediaSession? = null
}

class MainActivity : AppCompatActivity() {
    companion object {
        const val NEWTAB = "resource://android/assets/newtab.html"
        const val CARD = "resource://android/assets/card/card.html"
        private var runtime: GeckoRuntime? = null
        private var shieldExt: WebExtension? = null
        private var ambientExt: WebExtension? = null
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
    private lateinit var pillRow: LinearLayout
    private lateinit var pill: FrameLayout
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
                .globalPrivacyControlEnabled(true) // ask sites not to sell or share your data, like Oto for Windows
                .consoleOutput(false)
                .build()
        ).also { rt -> try { rt.settings.setFingerprintingProtection(prefs.getBoolean("fp", true)) } catch (e: Throwable) {} }
        installShieldExt()
        installAmbientExt()
        buildUi()
        restoreTabs()
        intent?.dataString?.let { if (it.startsWith("http")) openTab(it) }
        if (!introPlayed && savedInstanceState == null) playIntro()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = goBack()
        })
        thread { checkForUpdate(false) }
        thread { try { Danger.refresh(applicationContext) } catch (e: Throwable) {} }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { if (it.startsWith("http")) openTab(it) }
    }

    override fun onPause() { super.onPause(); saveTabs(); linkHandler.removeCallbacks(linkTick) }
    override fun onResume() { super.onResume(); linkHandler.removeCallbacks(linkTick); linkHandler.postDelayed(linkTick, 1500) }

    // ------------------------------------------------------------------ Oto account: this phone ⇄ your PC
    private val linkHandler = Handler(Looper.getMainLooper())
    private var linkBusy = false
    private var linkDevices: List<OtoLink.Device> = emptyList()
    private val linkTick = object : Runnable {
        override fun run() { linkBeat(); linkHandler.postDelayed(this, 30000) }
    }
    /** something changed (tab opened, page loaded): tell the PC in a few seconds */
    private fun linkSoon() { if (OtoLink.signedIn(this)) { linkHandler.removeCallbacks(linkSoonRun); linkHandler.postDelayed(linkSoonRun, 4000) } }
    private val linkSoonRun = Runnable { linkBeat() }
    private fun linkBeat(after: (() -> Unit)? = null) {
        if (linkBusy || !OtoLink.signedIn(this)) { after?.invoke(); return }
        linkBusy = true
        val me = OtoLink.info(this, tabs.map { it.url to it.title }, current()?.url ?: "")
        thread {
            val r = try { OtoLink.beat(this, me) } catch (e: OtoLink.LinkError) { if (e.auth) runOnUiThread { toast(e.message ?: "Please sign in again") }; null } catch (e: Exception) { null }
            runOnUiThread {
                linkBusy = false
                if (r != null) {
                    linkDevices = r.devices
                    r.inbox.forEach { m -> if (m.url.startsWith("http")) { tabs.add(Tab(m.url, m.title)); select(tabs.size - 1); toast("From ${m.from.ifBlank { "your PC" }}: ${m.title.ifBlank { prettyUrl(m.url) }}") } }
                }
                after?.invoke()
            }
        }
    }
    private fun pcs() = linkDevices.filter { it.kind == "pc" && !it.locked }
    private fun sendToPc(d: OtoLink.Device) {
        val t = current() ?: return
        if (!t.url.startsWith("http")) { toast("Open a web page first"); return }
        val from = OtoLink.info(this, emptyList(), "").optString("name", "Phone")
        thread {
            val err = try { OtoLink.send(this, d.id, t.url, t.title, from); null } catch (e: Exception) { e.message ?: "Couldn’t send" }
            runOnUiThread { toast(err ?: "Sent to ${d.name} ✓") }
        }
    }
    private fun ago(t: Long): String { val s = (System.currentTimeMillis() - t) / 1000; return when { s < 100 -> "ONLINE"; s < 3600 -> "${s / 60} MIN AGO"; s < 86400 -> "${s / 3600} H AGO"; else -> "${s / 86400} D AGO" } }

    private fun field(hintText: String, password: Boolean) = EditText(this).apply {
        hint = hintText; setHintTextColor(FG3); setTextColor(FG); textSize = 15f; isSingleLine = true
        background = box(0x08FFFFFF, LINE2, 6); setPadding(px(14), 0, px(14), 0)
        inputType = if (password) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
    }

    private fun showAccount() {
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(16), px(18), px(16), px(16)); background = box(BG, LINE2, 10) }
        if (!OtoLink.signedIn(this)) {
            panel.addView(label("—  音  OTO // ACCOUNT", "01"))
            panel.addView(TextView(this).apply { text = "Link to your PC"; textSize = 30f; setTextColor(FG); typeface = Typeface.SERIF; setPadding(px(4), 0, 0, px(6)) })
            panel.addView(TextView(this).apply { text = "Sign in with the same Oto account as Oto for Windows. Your PC then shows this phone — its battery and open tabs — and you can send tabs both ways."; textSize = 13.5f; setTextColor(FG2); setPadding(px(4), 0, px(4), px(14)) })
            val em = field("Email", false).apply { setText(OtoLink.email(this@MainActivity)) }
            val pw = field("Password", true)
            panel.addView(em, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(46)).apply { setMargins(0, 0, 0, px(8)) })
            panel.addView(pw, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(46)).apply { setMargins(0, 0, 0, px(8)) })
            val msg = TextView(this).apply { textSize = 12.5f; setTextColor(0xFFE8B4A8.toInt()); visibility = View.GONE; setPadding(px(4), px(2), px(4), px(8)) }
            panel.addView(msg)
            lateinit var go: TextView
            go = blockBtn("Sign in", true) {
                val e = em.text.toString().trim(); val p = pw.text.toString()
                if (e.isEmpty() || p.isEmpty()) { msg.text = "Type your email and password."; msg.visibility = View.VISIBLE; return@blockBtn }
                go.text = "SIGNING IN…"; go.isEnabled = false; msg.visibility = View.GONE
                thread {
                    val err = OtoLink.signIn(this, e, p)
                    runOnUiThread {
                        if (err != null) { go.text = "SIGN IN"; go.isEnabled = true; msg.text = err; msg.visibility = View.VISIBLE }
                        else { closeSheet(); endEdit(); toast("Signed in — this phone now shows up on your PC"); linkBeat() }
                    }
                }
            }
            panel.addView(go, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(44)))
            panel.addView(mono("End-to-end encrypted with your Oto password", 8.5f, FG3, 0.18f).apply { gravity = Gravity.CENTER; setPadding(0, px(14), 0, 0) })
        } else {
            val list = pcs()
            panel.addView(label("—  音  OTO // LINKED", String.format("%02d", list.size)))
            panel.addView(TextView(this).apply { text = if (list.isEmpty()) "No PC yet" else "Your PC"; textSize = 30f; setTextColor(FG); typeface = Typeface.SERIF; setPadding(px(4), 0, 0, px(4)) })
            panel.addView(mono(OtoLink.email(this), 9.5f, FG3, 0.14f).apply { isAllCaps = false; setPadding(px(4), 0, 0, px(12)) })
            if (list.isEmpty()) panel.addView(TextView(this).apply { text = "Open Oto on your PC and sign in with the same account. It shows up here."; textSize = 13.5f; setTextColor(FG2); setPadding(px(4), 0, px(4), px(14)) })
            list.forEach { d ->
                val b = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(12), px(12), px(12), px(12)); background = box(0x05FFFFFF, LINE2, 6) }
                val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                top.addView(TextView(this).apply { text = d.name; textSize = 15f; setTextColor(FG); setTypeface(Typeface.DEFAULT, Typeface.BOLD); maxLines = 1; ellipsize = TextUtils.TruncateAt.END }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                val a = ago(d.seen); top.addView(mono((if (a == "ONLINE") "●  " else "") + a, 9f, if (a == "ONLINE") CREAM else FG3, 0.18f))
                b.addView(top)
                b.addView(mono("${d.tabs.size} tabs open", 9f, FG3, 0.16f).apply { setPadding(0, px(4), 0, px(10)) })
                d.tabs.take(4).forEach { (u, ti) ->
                    b.addView(TextView(this).apply {
                        text = "↗  " + ti.ifBlank { prettyUrl(u) }; textSize = 13f; setTextColor(FG2); maxLines = 1; ellipsize = TextUtils.TruncateAt.END; setPadding(0, px(7), 0, px(7))
                        setOnClickListener { closeSheet(); openTab(u) }
                    })
                }
                b.addView(blockBtn("Send this tab to ${d.name}", true) { closeSheet(); sendToPc(d) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(40)).apply { setMargins(0, px(10), 0, 0) })
                panel.addView(b, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(0, 0, 0, px(8)) })
            }
            val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, px(4), 0, 0) }
            btns.addView(blockBtn("Sign out", false) { closeSheet(); thread { OtoLink.signOut(this); runOnUiThread { linkDevices = emptyList(); toast("Signed out") } } }, LinearLayout.LayoutParams(0, px(40), 1f).apply { setMargins(0, 0, px(6), 0) })
            btns.addView(blockBtn("Refresh", false) { linkBeat { if (sheet != null) showAccount() } }, LinearLayout.LayoutParams(0, px(40), 1f))
            panel.addView(btns)
        }
        val scroll = ScrollView(this).apply { addView(panel); isFillViewport = false }
        sheetFrame(scroll)
    }

    // Oto Shield = GeckoView's built-in blocking of ads, trackers, social trackers, fingerprinting and cryptominers,
    // plus cookies kept per site and tracking bits stripped from links, plus Oto's own blocker (installShieldExt). Dangerous-site warnings (Google Safe
    // Browsing, the same lists Firefox uses) are separate and stay on even with the Shield off.
    private fun shieldSettings(on: Boolean): ContentBlocking.Settings =
        ContentBlocking.Settings.Builder()
            .antiTracking(if (on) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.NONE)
            .enhancedTrackingProtectionLevel(if (on) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.NONE)
            .cookieBehavior(if (on) ContentBlocking.CookieBehavior.ACCEPT_FIRST_PARTY_AND_ISOLATE_OTHERS else ContentBlocking.CookieBehavior.ACCEPT_NON_TRACKERS)
            .queryParameterStrippingEnabled(on)
            .safeBrowsing(if (prefs.getBoolean("danger", true)) ContentBlocking.SafeBrowsing.DEFAULT else ContentBlocking.SafeBrowsing.NONE)
            .build()

    // Oto's own blocker (assets/shield): a small extension built into the app. It stops requests to known ad, tracker
    // and telemetry addresses and to ad scripts, and hides common ad boxes, next to the engine's tracking protection.
    // It follows the Shield switch. If it can't start, Oto still works with the engine's protection alone.
    private fun installShieldExt() {
        val rt = runtime ?: return
        if (shieldExt != null) return
        try {
            rt.webExtensionController.ensureBuiltIn("resource://android/assets/shield/", "shield@oto.app").accept({ ext ->
                shieldExt = ext
                // the blocker remembers whether it was on; make it match the Shield switch either way
                val want = prefs.getBoolean("shield", true)
                if (ext != null && ext.metaData.enabled != want) switchShieldExt(want) {}
            }, { e -> android.util.Log.w("Oto", "Oto Shield's own blocker could not start", e) })
        } catch (e: Throwable) { android.util.Log.w("Oto", "Oto Shield's own blocker could not start", e) }
    }

    // The YouTube ambient light (assets/ambient): the same light as Oto for Windows, in a second small built-in
    // extension that only runs on YouTube. It follows the "YouTube ambient light" switch (on by default).
    private fun installAmbientExt() {
        val rt = runtime ?: return
        if (ambientExt != null) return
        try {
            rt.webExtensionController.ensureBuiltIn("resource://android/assets/ambient/", "ambient@oto.app").accept({ ext ->
                ambientExt = ext
                val want = prefs.getBoolean("ambient", true)
                if (ext != null && ext.metaData.enabled != want) switchExt(ext, want) { e -> ambientExt = e }
            }, { e -> android.util.Log.w("Oto", "The YouTube ambient light could not start", e) })
        } catch (e: Throwable) { android.util.Log.w("Oto", "The YouTube ambient light could not start", e) }
    }

    private fun switchExt(ext: WebExtension, on: Boolean, done: (WebExtension) -> Unit) {
        val ctl = runtime?.webExtensionController ?: return
        try {
            val r = if (on) ctl.enable(ext, WebExtensionController.EnableSource.APP) else ctl.disable(ext, WebExtensionController.EnableSource.APP)
            r.accept({ e -> if (e != null) done(e) }, { })
        } catch (e: Throwable) { }
    }

    private fun setAmbient(on: Boolean) {
        prefs.edit().putBoolean("ambient", on).apply()
        val ext = ambientExt
        if (ext != null) switchExt(ext, on) { e -> ambientExt = e; runOnUiThread { if (current()?.url?.contains("youtube.com") == true) current()?.session?.reload() } }
        toast(if (on) "YouTube ambient light on (YouTube's dark theme)" else "YouTube ambient light off")
    }

    private fun switchShieldExt(on: Boolean, then: () -> Unit) {
        val ext = shieldExt
        val ctl = runtime?.webExtensionController
        if (ext == null || ctl == null) { then(); return }
        try {
            val r = if (on) ctl.enable(ext, WebExtensionController.EnableSource.APP) else ctl.disable(ext, WebExtensionController.EnableSource.APP)
            r.accept({ e -> if (e != null) shieldExt = e; then() }, { then() })
        } catch (e: Throwable) { then() }
    }

    private fun setDanger(on: Boolean) {
        prefs.edit().putBoolean("danger", on).apply()
        if (on) thread { try { Danger.refresh(applicationContext) } catch (e: Throwable) {} }
        runtime?.settings?.contentBlocking?.setSafeBrowsing(if (on) ContentBlocking.SafeBrowsing.DEFAULT else ContentBlocking.SafeBrowsing.NONE)
        toast(if (on) "Dangerous-site warnings on" else "Dangerous-site warnings off")
    }

    private fun setFingerprint(on: Boolean) {
        prefs.edit().putBoolean("fp", on).apply()
        try { runtime?.settings?.setFingerprintingProtection(on) } catch (e: Throwable) {}
        current()?.session?.reload()
        toast(if (on) "Fingerprint protection on" else "Fingerprint protection off")
    }

    // ------------------------------------------------------------------ site permissions (camera, mic, location…)
    private fun hostOf(u: String?): String = try { Uri.parse(u ?: "").host?.removePrefix("www.") ?: "" } catch (e: Exception) { "" }

    /** Android's own permission (camera, mic, location) for Oto itself, asked when a site you allowed needs it */
    private var androidPermCallback: GeckoSession.PermissionDelegate.Callback? = null
    private val askAndroid = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        val cb = androidPermCallback; androidPermCallback = null
        if (res.isNotEmpty() && res.values.all { it }) cb?.grant() else cb?.reject()
    }

    /** One question at a time: "<site> wants to use your camera" — Block / Allow, remembered for that site. */
    private val askQueue = ArrayDeque<Triple<String, String, (Boolean) -> Unit>>()
    private var asking: ((Boolean) -> Unit)? = null
    private fun askSite(host: String, what: String, done: (Boolean) -> Unit) {
        askQueue.addLast(Triple(host, what, done))
        if (asking == null) nextAsk()
    }
    private fun nextAsk() {
        val (host, what, done) = askQueue.removeFirstOrNull() ?: return
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(16), px(18), px(16), px(16)); background = box(BG, LINE2, 10) }
        panel.addView(label("—  音  OTO // PERMISSION"))
        panel.addView(TextView(this).apply { text = host.ifBlank { "This site" }; textSize = 28f; setTextColor(FG); typeface = Typeface.SERIF; setPadding(px(4), 0, 0, px(4)); maxLines = 1; ellipsize = TextUtils.TruncateAt.END })
        panel.addView(TextView(this).apply { text = "wants to $what. Oto remembers your answer for this site; change it any time in the menu → Site permissions."; textSize = 13.5f; setTextColor(FG2); setPadding(px(4), 0, px(4), px(14)) })
        val finish = { ok: Boolean -> asking = null; closeSheet(); done(ok); root.post { nextAsk() } }
        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        btns.addView(blockBtn("Block", false) { finish(false) }, LinearLayout.LayoutParams(0, px(44), 1f).apply { setMargins(0, 0, px(6), 0) })
        btns.addView(blockBtn("Allow", true) { finish(true) }, LinearLayout.LayoutParams(0, px(44), 1f))
        panel.addView(btns)
        closeSheet()
        sheetFrame(panel)
        asking = done
    }

    private fun decide(host: String, kind: String, what: String): GeckoResult<Int> {
        when (SitePerms.get(this, host, kind)) {
            SitePerms.ALLOW -> return GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW)
            SitePerms.BLOCK -> return GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_DENY)
        }
        val r = GeckoResult<Int>()
        askSite(host, what) { ok ->
            SitePerms.set(this, host, kind, ok)
            r.complete(if (ok) GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW else GeckoSession.PermissionDelegate.ContentPermission.VALUE_DENY)
        }
        return r
    }

    private val permissionDelegate = object : GeckoSession.PermissionDelegate {
        override fun onAndroidPermissionsRequest(session: GeckoSession, permissions: Array<out String>?, callback: GeckoSession.PermissionDelegate.Callback) {
            val need = (permissions ?: emptyArray()).filter { ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED }
            if (need.isEmpty()) { callback.grant(); return }
            androidPermCallback?.reject()
            androidPermCallback = callback
            askAndroid.launch(need.toTypedArray())
        }

        override fun onContentPermissionRequest(session: GeckoSession, perm: GeckoSession.PermissionDelegate.ContentPermission): GeckoResult<Int>? {
            val allow = GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW)
            val deny = GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_DENY)
            val host = hostOf(perm.uri)
            return when (perm.permission) {
                GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE, GeckoSession.PermissionDelegate.PERMISSION_MEDIA_KEY_SYSTEM_ACCESS, GeckoSession.PermissionDelegate.PERMISSION_PERSISTENT_STORAGE -> allow
                GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE -> if (SitePerms.get(this@MainActivity, host, "autoplay") == SitePerms.BLOCK) deny else allow
                // Oto for Android doesn't show web notifications, so sites aren't asked to annoy you with the question
                GeckoSession.PermissionDelegate.PERMISSION_DESKTOP_NOTIFICATION -> deny
                GeckoSession.PermissionDelegate.PERMISSION_GEOLOCATION -> decide(host, "location", "know your location")
                GeckoSession.PermissionDelegate.PERMISSION_XR -> decide(host, "xr", "use virtual reality")
                GeckoSession.PermissionDelegate.PERMISSION_STORAGE_ACCESS -> decide(host, "storage:" + hostOf(perm.thirdPartyOrigin), "use its cookies inside ${hostOf(perm.thirdPartyOrigin).ifBlank { "another site" }}")
                else -> GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_PROMPT)
            }
        }

        override fun onMediaPermissionRequest(session: GeckoSession, uri: String, video: Array<out GeckoSession.PermissionDelegate.MediaSource>?, audio: Array<out GeckoSession.PermissionDelegate.MediaSource>?, callback: GeckoSession.PermissionDelegate.MediaCallback) {
            val host = hostOf(uri)
            val kinds = listOfNotNull(if (!video.isNullOrEmpty()) "camera" else null, if (!audio.isNullOrEmpty()) "mic" else null)
            if (kinds.isEmpty()) { callback.reject(); return }
            val finish = { ok: Boolean ->
                if (!ok) callback.reject()
                else {
                    val v = video?.firstOrNull { it.source == GeckoSession.PermissionDelegate.MediaSource.SOURCE_CAMERA } ?: video?.firstOrNull()
                    val a = audio?.firstOrNull { it.source == GeckoSession.PermissionDelegate.MediaSource.SOURCE_MICROPHONE } ?: audio?.firstOrNull()
                    callback.grant(v?.id, a?.id)
                }
            }
            val saved = kinds.map { SitePerms.get(this@MainActivity, host, it) }
            if (saved.any { it == SitePerms.BLOCK }) { callback.reject(); return }
            if (saved.all { it == SitePerms.ALLOW }) { finish(true); return }
            val what = when { kinds.size == 2 -> "use your camera and microphone"; kinds[0] == "camera" -> "use your camera"; else -> "use your microphone" }
            askSite(host, what) { ok -> kinds.forEach { SitePerms.set(this@MainActivity, host, it, ok) }; finish(ok) }
        }
    }

    /** Menu → Site permissions: this site's choices (tap to change), then every site you've answered for. */
    private fun showSitePermissions() {
        val host = current()?.url?.takeIf { it.startsWith("http") }?.let { hostOf(it) } ?: ""
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(14), px(18), px(14), px(10)); background = box(BG, LINE2, 10) }
        panel.addView(label("—  音  OTO // SITE PERMISSIONS"))
        val kinds = listOf("camera" to "Camera", "mic" to "Microphone", "location" to "Location", "autoplay" to "Autoplay with sound")
        fun word(v: Int?, kind: String) = when (v) { SitePerms.ALLOW -> "ALLOW"; SitePerms.BLOCK -> "BLOCK"; else -> if (kind == "autoplay") "ALLOW" else "ASK" }
        if (host.isNotEmpty()) {
            panel.addView(TextView(this).apply { text = host; textSize = 26f; setTextColor(FG); typeface = Typeface.SERIF; setPadding(px(6), 0, 0, px(8)); maxLines = 1; ellipsize = TextUtils.TruncateAt.END })
            kinds.forEach { (k, name) ->
                val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(px(6), px(13), px(6), px(13)) }
                val v = mono(word(SitePerms.get(this, host, k), k), 10f, CREAM, 0.2f)
                r.addView(mono(name, 11f, FG, 0.16f), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)); r.addView(v)
                r.setOnClickListener {
                    // Ask → Allow → Block → Ask (autoplay: Allow ⇄ Block)
                    val now = SitePerms.get(this, host, k)
                    val next: Boolean? = if (k == "autoplay") (if (now == SitePerms.BLOCK) null else false) else when (now) { null -> true; SitePerms.ALLOW -> false; else -> null }
                    SitePerms.set(this, host, k, next); v.text = word(SitePerms.get(this, host, k), k)
                }
                panel.addView(r)
                panel.addView(View(this).apply { setBackgroundColor(LINE) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, maxOf(1, dp.toInt())))
            }
        }
        val others = SitePerms.all(this).filterKeys { it != host }
        panel.addView(mono(if (others.isEmpty()) "No other sites yet" else "Other sites", 9f, FG3, 0.2f).apply { setPadding(px(6), px(16), 0, px(6)) })
        others.forEach { (h, m) ->
            val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(px(6), px(8), 0, px(8)) }
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            col.addView(TextView(this).apply { text = h; textSize = 14f; setTextColor(FG); maxLines = 1; ellipsize = TextUtils.TruncateAt.END })
            col.addView(mono(m.entries.joinToString(" · ") { (k, v) -> (kinds.firstOrNull { it.first == k }?.second ?: k.substringBefore(':')) + " " + (if (v == SitePerms.ALLOW) "allowed" else "blocked") }, 8.5f, FG3, 0.1f).apply { isAllCaps = false })
            r.addView(col, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            r.addView(TextView(this).apply { text = "×"; textSize = 18f; setTextColor(FG2); gravity = Gravity.CENTER; setOnClickListener { SitePerms.forget(this@MainActivity, h); showSitePermissions() } }, LinearLayout.LayoutParams(px(40), px(36)))
            panel.addView(r)
        }
        val scroll = ScrollView(this).apply { addView(panel) }
        sheetFrame(scroll)
    }

    /** A web page wants to open another app (tel:, mailto:, intent:…) without you tapping: ask first. */
    private fun confirmOpenApp(target: String, go: () -> Unit) {
        val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(px(16), px(18), px(16), px(16)); background = box(BG, LINE2, 10) }
        panel.addView(label("—  音  OTO // OPEN APP"))
        panel.addView(TextView(this).apply { text = "Open another app?"; textSize = 26f; setTextColor(FG); typeface = Typeface.SERIF; setPadding(px(4), 0, 0, px(4)) })
        panel.addView(TextView(this).apply { text = "This page wants to open $target. Only continue if you expected that."; textSize = 13.5f; setTextColor(FG2); setPadding(px(4), 0, px(4), px(14)) })
        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        btns.addView(blockBtn("Stay here", false) { closeSheet() }, LinearLayout.LayoutParams(0, px(44), 1f).apply { setMargins(0, 0, px(6), 0) })
        btns.addView(blockBtn("Open", true) { closeSheet(); go() }, LinearLayout.LayoutParams(0, px(44), 1f))
        panel.addView(btns)
        sheetFrame(panel)
    }

    private fun setShield(on: Boolean) {
        prefs.edit().putBoolean("shield", on).apply()
        runtime?.settings?.contentBlocking?.let {
            it.setAntiTracking(if (on) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.NONE)
            it.setEnhancedTrackingProtectionLevel(if (on) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.NONE)
        }
        switchShieldExt(on) { current()?.session?.reload() } // reload once Oto's own blocker has switched too
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

        pill = FrameLayout(this).apply { background = box(0x08FFFFFF) }
        pillRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(px(12), 0, px(12), 0) }
        pillRow.addView(TextView(this).apply { text = "音"; textSize = 14f; setTextColor(FG); setPadding(0, 0, px(10), 0) })
        urlText = TextView(this).apply { textSize = 14f; setTextColor(FG2); maxLines = 1; ellipsize = TextUtils.TruncateAt.END; hint = "Search or enter address"; setHintTextColor(FG3) }
        pillRow.addView(urlText, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        pill.addView(pillRow, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        urlEdit = EditText(this).apply {
            visibility = View.GONE; textSize = 15f; setTextColor(FG); setHintTextColor(FG3); hint = "Search or enter address"
            background = null; setPadding(px(12), 0, px(12), 0); isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_GO; inputType = EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_VARIATION_URI or EditorInfo.TYPE_TEXT_FLAG_NO_SUGGESTIONS
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
        urlEdit.setText(if (t.url == NEWTAB || t.url.startsWith(CARD)) "" else t.url)
        // the address text underneath was showing through what you type: hide it while editing
        pillRow.visibility = View.INVISIBLE
        pill.background = box(0x0DFFFFFF, CREAM)
        urlEdit.visibility = View.VISIBLE
        urlEdit.requestFocus()
        urlEdit.selectAll()
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(urlEdit, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun endEdit() {
        urlEdit.visibility = View.GONE
        pillRow.visibility = View.VISIBLE
        pill.background = box(0x08FFFFFF)
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(urlEdit.windowToken, 0)
    }

    private fun refreshBar() {
        val t = current()
        urlText.text = if (t == null || t.url == NEWTAB) "" else if (t.url.startsWith(CARD)) "Oto Card" else prettyUrl(t.url)
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
                // a link that opens a new window: the engine opens this session itself. It opens behind the tab you're
                // on ("Links open in the background", on by default) with a small bar to switch to it; its video waits
                // until you open it.
                val ns = newSession()
                val idx = cur + 1
                val bg = prefs.getBoolean("linksBg", true)
                val t = Tab(uri).also { it.session = ns; it.unseen = bg && prefs.getBoolean("holdMedia", true) }
                tabs.add(idx, t)
                if (bg) root.post {
                    try { ns.setActive(false) } catch (e: Throwable) {}
                    refreshBar(); saveTabs()
                    openedBehind(t)
                } else root.post { select(idx) }
                return GeckoResult.fromValue(ns)
            }
            override fun onLoadRequest(session: GeckoSession, request: GeckoSession.NavigationDelegate.LoadRequest): GeckoResult<AllowOrDeny>? {
                val scheme = Uri.parse(request.uri).scheme?.lowercase() ?: return null
                // the buttons on Oto's warning page
                if (scheme == "oto-back") { if (tabFor(session)?.canBack == true) session.goBack() else tabFor(session)?.let { navigate("about:blank"); it.blocked = null }; return GeckoResult.fromValue(AllowOrDeny.DENY) }
                if (scheme == "oto-continue") {
                    val t = tabFor(session); val u = t?.blocked
                    if (u != null && request.hasUserGesture) { t.blocked = null; Danger.allow(Uri.parse(u).host ?: ""); session.load(GeckoSession.Loader().uri(u).flags(GeckoSession.LOAD_FLAGS_BYPASS_CLASSIFIER)) }
                    return GeckoResult.fromValue(AllowOrDeny.DENY)
                }
                // Oto's own dangerous-site lists (Google Safe Browsing is checked by the engine itself, see onLoadError)
                if ((scheme == "http" || scheme == "https") && prefs.getBoolean("danger", true)) {
                    Danger.check(Uri.parse(request.uri).host)?.let { kind ->
                        tabFor(session)?.blocked = request.uri
                        session.loadUri(ErrorPage.dataUri(kind, hostOf(request.uri), "oto"))
                        return GeckoResult.fromValue(AllowOrDeny.DENY)
                    }
                }
                if (scheme in listOf("http", "https", "about", "data", "blob", "file", "resource", "javascript", "moz-extension")) return null
                // tel:, mailto:, intent:, app links → the right app. Never another app's private screens, never Oto itself,
                // and a page that tries it without you tapping gets asked about first.
                val i = try {
                    (if (scheme == "intent") Intent.parseUri(request.uri, Intent.URI_INTENT_SCHEME) else Intent(Intent.ACTION_VIEW, Uri.parse(request.uri))).apply {
                        component = null; selector = null; addCategory(Intent.CATEGORY_BROWSABLE)
                    }
                } catch (e: Exception) { null } ?: return GeckoResult.fromValue(AllowOrDeny.DENY)
                if (i.`package` == packageName) return GeckoResult.fromValue(AllowOrDeny.DENY)
                val fallback = i.getStringExtra("browser_fallback_url")?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
                val launch = {
                    try { startActivity(i) } catch (e: ActivityNotFoundException) { if (fallback != null) session.loadUri(fallback) else toast("No app can open this link") } catch (e: Exception) {}
                }
                if (request.hasUserGesture || request.isDirectNavigation) launch()
                else runOnUiThread { confirmOpenApp(i.`package` ?: scheme + ": link") { launch() } }
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            override fun onLoadError(session: GeckoSession, uri: String?, error: WebRequestError): GeckoResult<String>? {
                val kind = when {
                    error.category == WebRequestError.ERROR_CATEGORY_SAFEBROWSING -> if (error.code == WebRequestError.ERROR_SAFEBROWSING_PHISHING_URI) "phishing" else "malware"
                    error.category == WebRequestError.ERROR_CATEGORY_SECURITY || error.code == WebRequestError.ERROR_BAD_HSTS_CERT -> "cert"
                    else -> return null // other errors: the engine's own page
                }
                tabFor(session)?.blocked = if (kind == "cert") null else uri
                return GeckoResult.fromValue(ErrorPage.dataUri(kind, hostOf(uri)))
            }
        }
        s.permissionDelegate = permissionDelegate
        // a tab opened in the background that you haven't looked at: its video/audio doesn't start by itself
        s.mediaSessionDelegate = object : MediaSession.Delegate {
            override fun onPlay(session: GeckoSession, mediaSession: MediaSession) {
                val t = tabFor(session) ?: return
                if (t.unseen && t !== current()) { t.heldMedia = mediaSession; try { mediaSession.pause() } catch (e: Throwable) {} }
            }
            override fun onDeactivated(session: GeckoSession, mediaSession: MediaSession) {
                tabFor(session)?.let { if (it.heldMedia === mediaSession) it.heldMedia = null }
            }
        }
        s.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onProgressChange(session: GeckoSession, progress: Int) { tabFor(session)?.progress = progress; if (tabFor(session) === current()) refreshBar() }
            override fun onPageStart(session: GeckoSession, url: String) { tabFor(session)?.progress = 5; refreshBar() }
            override fun onPageStop(session: GeckoSession, success: Boolean) { tabFor(session)?.progress = 100; refreshBar(); saveTabs(); linkSoon() }
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

    // ------------------------------------------------------------------ your Oto Card
    // The card you made on your PC (with your level and badges), drawn by the same code as Oto for Windows
    // (assets/card). The last card fetched shows straight away; a fresh one is fetched and the page updates if changed.
    private fun cardUrl(d: org.json.JSONObject?): String {
        if (d == null) return CARD
        val b = android.util.Base64.encodeToString(d.toString().toByteArray(Charsets.UTF_8), android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING)
        return "$CARD#d=$b"
    }
    private fun showCard() {
        val saved = OtoLink.savedCard(this)
        val existing = tabs.indexOfFirst { it.url.startsWith(CARD) }
        if (existing >= 0) { tabs[existing].url = cardUrl(saved); select(existing); tabs[existing].session?.loadUri(tabs[existing].url) } else openTab(cardUrl(saved))
        if (!OtoLink.signedIn(this)) return
        thread {
            val fresh = try { OtoLink.pullCard(applicationContext) } catch (e: Throwable) { null }
            if (fresh != null && fresh.toString() != saved?.toString()) runOnUiThread {
                val i = tabs.indexOfFirst { it.url.startsWith(CARD) }
                if (i >= 0) { tabs[i].url = cardUrl(fresh); tabs[i].session?.loadUri(tabs[i].url) }
            }
        }
    }

    private fun openTab(url: String = NEWTAB) {
        tabs.add(Tab(url))
        select(tabs.size - 1)
    }

    private fun select(i: Int) {
        if (tabs.isEmpty()) { openTab(); return }
        cur = i.coerceIn(0, tabs.size - 1)
        val t = tabs[cur]
        var s = t.session
        var fresh = false
        if (s == null) {
            s = newSession(); t.session = s
            s.open(runtime!!)
            s.loadUri(t.url); fresh = true
        } else if (!s.isOpen) {
            s.open(runtime!!); s.loadUri(t.url); fresh = true
        }
        gecko.releaseSession()
        gecko.setSession(s)
        // a page that is only starting to load: Oto's dark background instead of a white flash until it draws
        if (fresh) try { gecko.coverUntilFirstPaint(BG) } catch (e: Throwable) {}
        try { s.setActive(true) } catch (e: Throwable) {}
        if (t.unseen) {
            t.unseen = false
            t.heldMedia?.let { m -> t.heldMedia = null; try { m.play() } catch (e: Throwable) {} }
        }
        refreshBar()
        saveTabs()
    }

    private fun closeTab(i: Int) {
        val t = tabs.getOrNull(i) ?: return
        if (i == cur) gecko.releaseSession()
        t.session?.close()
        tabs.removeAt(i)
        linkSoon()
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
    private fun closeSheet() {
        sheet?.let { root.removeView(it) }; sheet = null
        asking?.let { a -> asking = null; a(false); root.post { nextAsk() } }
    }

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
        val linked = OtoLink.signedIn(this)
        if (linked && t != null && t.url.startsWith("http")) pcs().forEach { d -> row("Send to ${d.name}", ago(d.seen).let { if (it == "ONLINE") "ON" else "" }) { sendToPc(d) } }
        row("Oto account", if (linked) "LINKED" else "SIGN IN") { if (linked) linkBeat { showAccount() } else showAccount() }
        row("Oto Card", if (linked) "YOURS" else "") { showCard() }
        row("Oto Shield", if (shieldOn) "ON" else "OFF") { setShield(!shieldOn) }
        row("Dangerous-site warnings", if (prefs.getBoolean("danger", true)) "ON" else "OFF") { setDanger(!prefs.getBoolean("danger", true)) }
        row("YouTube ambient light", if (prefs.getBoolean("ambient", true)) "ON" else "OFF") { setAmbient(!prefs.getBoolean("ambient", true)) }
        row("Fingerprint protection", if (prefs.getBoolean("fp", true)) "ON" else "OFF") { setFingerprint(!prefs.getBoolean("fp", true)) }
        row("Site permissions") { showSitePermissions() }
        row("Desktop site", if (prefs.getBoolean("desktop", false)) "ON" else "OFF") { setDesktop(!prefs.getBoolean("desktop", false)) }
        row("Links open in the background", if (prefs.getBoolean("linksBg", true)) "ON" else "OFF") { val on = !prefs.getBoolean("linksBg", true); prefs.edit().putBoolean("linksBg", on).apply(); toast(if (on) "Links that open a new tab open behind this one" else "Links that open a new tab open in front") }
        row("Videos wait until you open their tab", if (prefs.getBoolean("holdMedia", true)) "ON" else "OFF") { val on = !prefs.getBoolean("holdMedia", true); prefs.edit().putBoolean("holdMedia", on).apply() }
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
            // the APK sits on the Oto release as Oto-Android-<version>-arm64.apk
            var apk: JSONObject? = null; var bestV = BuildConfig.VERSION_NAME
            val re = Regex("^Oto-Android-([0-9.]+)-arm64\\.apk$")
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i).optJSONArray("assets") ?: continue
                for (j in 0 until a.length()) {
                    val f = a.getJSONObject(j); val v = re.find(f.optString("name"))?.groupValues?.get(1) ?: continue
                    if (newer(v, bestV)) { apk = f; bestV = v }
                }
            }
            val best = apk; val ver = bestV
            runOnUiThread {
                if (best != null) showUpdate(ver, best.getString("browser_download_url"))
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

    /** "Opened in a new tab — SWITCH", just above the bar for a few seconds */
    private var behindBar: View? = null
    private fun openedBehind(t: Tab) {
        behindBar?.let { root.removeView(it) }
        val b = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(px(14), px(10), px(8), px(10)); background = box(RAISE, LINE2, 8)
        }
        b.addView(TextView(this).apply { text = "Opened in a new tab"; textSize = 13.5f; setTextColor(FG); maxLines = 1; ellipsize = TextUtils.TruncateAt.END }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        b.addView(mono("Switch", 10f, CREAM, 0.2f).apply {
            gravity = Gravity.CENTER; setPadding(px(12), px(6), px(12), px(6))
            setOnClickListener { root.removeView(b); behindBar = null; val i = tabs.indexOf(t); if (i >= 0) select(i) }
        })
        val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM).apply { setMargins(px(10), 0, px(10), bar.height + px(14)) }
        root.addView(b, lp)
        behindBar = b
        b.alpha = 0f; b.translationY = 12 * dp; b.animate().alpha(1f).translationY(0f).setDuration(180).start()
        root.postDelayed({ if (behindBar === b) { b.animate().alpha(0f).setDuration(200).withEndAction { root.removeView(b); if (behindBar === b) behindBar = null }.start() } }, 4000)
    }
}
