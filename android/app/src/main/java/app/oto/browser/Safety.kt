package app.oto.browser

import android.content.Context
import android.util.Base64
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Site permissions you chose (camera, microphone, location, autoplay…), remembered per site on this phone.
 * Stored as "host|kind" -> 1 (allow) or 2 (block). Nothing here leaves the phone.
 */
object SitePerms {
    const val ALLOW = 1
    const val BLOCK = 2
    private fun p(c: Context) = c.getSharedPreferences("oto_perms", Context.MODE_PRIVATE)
    fun get(c: Context, host: String, kind: String): Int? = p(c).getInt("$host|$kind", 0).takeIf { it != 0 }
    fun set(c: Context, host: String, kind: String, allow: Boolean?) {
        val e = p(c).edit()
        if (allow == null) e.remove("$host|$kind") else e.putInt("$host|$kind", if (allow) ALLOW else BLOCK)
        e.apply()
    }
    fun forget(c: Context, host: String) {
        val e = p(c).edit()
        p(c).all.keys.filter { it.startsWith("$host|") }.forEach { e.remove(it) }
        e.apply()
    }
    /** host -> (kind -> value), sorted by host */
    fun all(c: Context): Map<String, Map<String, Int>> {
        val out = sortedMapOf<String, MutableMap<String, Int>>()
        for ((k, v) in p(c).all) {
            val i = k.lastIndexOf('|'); if (i <= 0 || v !is Int) continue
            out.getOrPut(k.substring(0, i)) { mutableMapOf() }[k.substring(i + 1)] = v
        }
        return out
    }
}

/**
 * Oto's own dangerous-site lists, the same ones Oto for Windows uses: known malware hosts from URLhaus (abuse.ch)
 * and the phishing filter by malware-filter. Downloaded twice a day and checked on the phone, nothing is sent
 * anywhere. A second layer next to Google Safe Browsing, so warnings still work if Google's lists can't load.
 */
object Danger {
    private val LISTS = mapOf(
        "malware" to listOf("https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains.txt", "https://curbengh.github.io/malware-filter/urlhaus-filter-domains.txt", "https://malware-filter.pages.dev/urlhaus-filter-domains.txt"),
        "phishing" to listOf("https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt", "https://curbengh.github.io/malware-filter/phishing-filter-domains.txt", "https://malware-filter.pages.dev/phishing-filter-domains.txt"),
    )
    @Volatile private var sets: Map<String, Set<String>> = emptyMap()
    @Volatile var updatedAt = 0L
        private set
    /** sites you chose "Continue anyway" for, until Oto restarts */
    private val allowed = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private val okHost = Regex("^[a-z0-9.:\\[\\]-]+$")

    private fun file(c: Context, kind: String) = File(c.filesDir, "danger-$kind.txt")
    private fun parse(text: String): Set<String> = text.lineSequence().map { it.trim().lowercase() }.filter { it.isNotEmpty() && it[0] != '#' && it[0] != '!' && okHost.matches(it) }.toHashSet()

    /** Load the saved lists (from the phone), then download fresh ones if they're older than 12 hours. Call off the UI thread. */
    fun refresh(c: Context, force: Boolean = false) {
        if (sets.isEmpty()) {
            val m = mutableMapOf<String, Set<String>>()
            for (k in LISTS.keys) file(c, k).takeIf { it.exists() }?.let { f -> m[k] = parse(f.readText()); updatedAt = maxOf(updatedAt, f.lastModified()) }
            sets = m
        }
        if (!force && System.currentTimeMillis() - updatedAt < 12 * 3600_000L) return
        val m = sets.toMutableMap()
        var got = false
        for ((kind, urls) in LISTS) for (u in urls) {
            try {
                val con = (URL(u).openConnection() as HttpURLConnection).apply { connectTimeout = 15000; readTimeout = 30000; setRequestProperty("User-Agent", "Oto") }
                if (con.responseCode != 200) { con.disconnect(); continue }
                val text = con.inputStream.bufferedReader().use { it.readText() }
                con.disconnect()
                val set = parse(text)
                if (set.size < 100) continue
                file(c, kind).writeText(text); m[kind] = set; got = true
                break
            } catch (e: Exception) { }
        }
        if (got) { sets = m; updatedAt = System.currentTimeMillis() }
    }

    /** "phishing", "malware" or null. A listed domain also covers its subdomains (evil.example covers x.evil.example). */
    fun check(host: String?): String? {
        var h = (host ?: return null).lowercase().trimEnd('.')
        if (h.isEmpty() || h in allowed) return null
        val s = sets
        if (s.isEmpty()) return null
        while (h.contains('.')) {
            if (s["phishing"]?.contains(h) == true) return "phishing"
            if (s["malware"]?.contains(h) == true) return "malware"
            h = h.substringAfter('.')
        }
        return null
    }
    fun allow(host: String) { allowed.add(host.lowercase()) }
    fun count() = sets.values.sumOf { it.size }
}

/** Oto's own pages for a dangerous site (Safe Browsing) or a broken certificate, in the Oto look. */
object ErrorPage {
    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    /** source: "google" (Google Safe Browsing) or "oto" (Oto's own lists from URLhaus / malware-filter) */
    fun dataUri(kind: String, host: String, source: String = "google"): String {
        val list = if (source == "oto") "a list of known" else "Google Safe Browsing's list of"
        val h = esc(host.ifBlank { "this site" })
        val (label, title, text, canContinue) = when (kind) {
            "phishing" -> Quad("DANGEROUS / STOPPED", "This site may steal your passwords",
                "<b>$h</b> is on $list fake sites that pretend to be a real one (phishing) to get your passwords or card details. Oto stopped before it opened.", true)
            "malware" -> Quad("DANGEROUS / STOPPED", "This site may harm your phone",
                "<b>$h</b> is on $list sites that spread harmful or unwanted software. Oto stopped before it opened, so nothing was downloaded.", true)
            else -> Quad("NOT SAFE / STOPPED", "This site isn’t safe right now",
                "The lock for <b>$h</b> is broken, so someone could see or change what you send. Oto stopped before the page opened.", false)
        }
        val more = if (canContinue) "<a class=\"q\" href=\"oto-continue:go\">Continue anyway (not recommended)</a>" else ""
        val html = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>$title</title><style>
html,body{margin:0;height:100%;background:#0b0b0c;color:#ece8e1;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:32px 26px;box-sizing:border-box;max-width:560px;margin:0 auto}
.ic{width:64px;height:64px;border-radius:8px;border:1px solid rgba(232,180,168,.45);display:grid;place-items:center;color:#e8b4a8;font-size:30px;margin-bottom:22px}
.l{display:flex;align-items:center;gap:10px;font:600 10px monospace;letter-spacing:.26em;color:rgba(236,232,225,.6);margin-bottom:14px}
.l i{width:16px;height:1px;background:rgba(236,232,225,.6)} .l em{flex:1;max-width:90px;height:1px;background:rgba(255,255,255,.14)}
h1{font:400 34px/1.08 Georgia,"Times New Roman",serif;margin:0 0 12px;letter-spacing:-.4px}
p{color:rgba(236,232,225,.68);margin:0 0 26px} p b{color:#ece8e1;font-weight:600}
a.b{display:block;text-align:center;padding:13px;border-radius:4px;background:#e8b4a8;color:#131313;text-decoration:none;font:600 11px monospace;letter-spacing:.18em}
a.q{display:block;text-align:center;margin-top:16px;color:rgba(236,232,225,.45);font-size:13px}
</style></head><body><main>
<div class="ic">!</div><div class="l"><i></i><span>音&nbsp; $label</span><em></em></div>
<h1>$title</h1><p>$text</p><a class="b" href="oto-back:go">← GO BACK</a>$more
</main></body></html>"""
        return "data:text/html;charset=utf-8;base64," + Base64.encodeToString(html.toByteArray(), Base64.NO_WRAP)
    }

    private data class Quad(val a: String, val b: String, val c: String, val d: Boolean)
}
