package app.oto.browser

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.bouncycastle.crypto.generators.SCrypt
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Oto account on the phone: sign in with the same Oto account as the PC, then this phone shows up in
 * Windows Oto ("My phone") with its battery and open tabs, and tabs can be sent both ways.
 *
 * Same privacy as the PC: everything about the device is encrypted with a key made from your Oto
 * password (scrypt, exactly like Oto for Windows), so the server only stores scrambled text. Login tokens
 * and the key are kept on the phone, locked with the Android Keystore.
 */
object OtoLink {
    // Public project settings — the same publishable key Oto for Windows ships with.
    private const val API = "https://lshiexrntuvueizntvky.supabase.co"
    private const val KEY = "sb_publishable__7WNQA_K0zOmZfFDaSnhNw_4Kebnwtd"

    class Device(val id: String, val kind: String, val name: String, val seen: Long, val tabs: List<Pair<String, String>>, val locked: Boolean)
    class Sent(val url: String, val title: String, val from: String)
    class Beat(val devices: List<Device>, val inbox: List<Sent>)
    class LinkError(msg: String, val auth: Boolean = false) : Exception(msg)

    private fun prefs(c: Context) = c.getSharedPreferences("oto_link", Context.MODE_PRIVATE)
    fun signedIn(c: Context) = prefs(c).getString("uid", null) != null && prefs(c).getString("key", null) != null
    fun email(c: Context): String = prefs(c).getString("email", "") ?: ""
    fun deviceId(c: Context): String {
        val p = prefs(c)
        return p.getString("device", null) ?: UUID.randomUUID().toString().also { p.edit().putString("device", it).apply() }
    }
    fun signOut(c: Context) {
        val p = prefs(c); val token = try { access(c) } catch (e: Exception) { null }
        if (token != null) try { http("POST", "/auth/v1/logout", null, token) } catch (e: Exception) {}
        p.edit().remove("uid").remove("key").remove("access").remove("refresh").remove("exp").remove("card").apply()
    }

    // ------------------------------------------------------------ Keystore-locked storage
    private fun vaultKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey("oto_link", null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder("oto_link", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return g.generateKey()
    }
    private fun seal(s: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, vaultKey())
        return b64(c.iv) + ":" + b64(c.doFinal(s.toByteArray()))
    }
    private fun unseal(s: String?): String? {
        if (s == null) return null
        return try {
            val (iv, data) = s.split(":")
            val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE, vaultKey(), GCMParameterSpec(128, unb64(iv)))
            String(c.doFinal(unb64(data)))
        } catch (e: Exception) { null }
    }
    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.DEFAULT)

    // ------------------------------------------------------------ HTTP
    private fun http(method: String, path: String, body: Any?, token: String? = null, prefer: String? = null): Any? {
        val c = URL(API + path).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = 12000; c.readTimeout = 15000
        c.setRequestProperty("apikey", KEY); c.setRequestProperty("Content-Type", "application/json")
        if (token != null) c.setRequestProperty("Authorization", "Bearer $token")
        if (prefer != null) c.setRequestProperty("Prefer", prefer)
        if (body != null) { c.doOutput = true; c.outputStream.use { it.write(body.toString().toByteArray()) } }
        val code = try { c.responseCode } catch (e: Exception) { throw LinkError("Can’t reach Oto Accounts — check your internet.") }
        val txt = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
        if (code !in 200..299) {
            val j = try { JSONObject(txt) } catch (e: Exception) { JSONObject() }
            val msg = j.optString("msg", j.optString("error_description", j.optString("message", "Error $code")))
            val pg = j.optString("code")
            if (pg in listOf("42P01", "PGRST205", "42501", "PGRST106")) throw LinkError("The Oto server isn’t set up for phones yet.")
            throw LinkError(msg, auth = code == 401 || code == 400 && path.contains("grant_type"))
        }
        if (txt.isBlank()) return null
        return if (txt.trimStart().startsWith("[")) JSONArray(txt) else JSONObject(txt)
    }
    private fun takeSession(c: Context, s: JSONObject) {
        val user = s.optJSONObject("user")
        prefs(c).edit()
            .putString("uid", user?.optString("id") ?: prefs(c).getString("uid", null))
            .putString("access", seal(s.getString("access_token")))
            .putString("refresh", seal(s.getString("refresh_token")))
            .putLong("exp", System.currentTimeMillis() + s.optLong("expires_in", 3600) * 1000 - 60000)
            .apply()
    }
    @Synchronized private fun access(c: Context): String {
        val p = prefs(c)
        if (System.currentTimeMillis() < p.getLong("exp", 0)) unseal(p.getString("access", null))?.let { return it }
        val r = unseal(p.getString("refresh", null)) ?: throw LinkError("Please sign in again", auth = true)
        try { takeSession(c, http("POST", "/auth/v1/token?grant_type=refresh_token", JSONObject().put("refresh_token", r)) as JSONObject) }
        catch (e: LinkError) { if (e.auth) { p.edit().remove("uid").remove("key").apply(); throw LinkError("Your sign-in expired — please sign in again", auth = true) }; throw e }
        return unseal(p.getString("access", null)) ?: throw LinkError("Please sign in again", auth = true)
    }

    // ------------------------------------------------------------ encryption (same format as Oto for Windows)
    private fun encrypt(o: JSONObject, key: ByteArray): String {
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
        val out = c.doFinal(o.toString().toByteArray(Charsets.UTF_8))
        val data = out.copyOfRange(0, out.size - 16); val tag = out.copyOfRange(out.size - 16, out.size)
        return "v1.${b64(iv)}.${b64(tag)}.${b64(data)}"
    }
    private fun decrypt(blob: String, key: ByteArray): JSONObject {
        val p = blob.split(".")
        if (p.size != 4 || p[0] != "v1") throw LinkError("format")
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, unb64(p[1])))
        return JSONObject(String(c.doFinal(unb64(p[3]) + unb64(p[2])), Charsets.UTF_8))
    }
    private fun devKey(c: Context): ByteArray {
        val k = unseal(prefs(c).getString("key", null)) ?: throw LinkError("Please sign in again", auth = true)
        val m = Mac.getInstance("HmacSHA256"); m.init(SecretKeySpec(unb64(k), "HmacSHA256"))
        return m.doFinal("oto-devices-v1".toByteArray())
    }
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    // ------------------------------------------------------------ sign in
    /** Runs on a background thread (scrypt takes a moment). Returns null when it worked, or what went wrong. */
    fun signIn(c: Context, email: String, password: String): String? {
        return try {
            val s = try { http("POST", "/auth/v1/token?grant_type=password", JSONObject().put("email", email.trim()).put("password", password)) as JSONObject }
            catch (e: LinkError) { return if (e.message?.contains("confirm", true) == true) "Please confirm your email first — check your inbox." else if (e.message?.contains("invalid", true) == true) "Wrong email or password." else e.message }
            takeSession(c, s)
            val uid = prefs(c).getString("uid", "")!!
            val rows = http("GET", "/rest/v1/oto_sync?user_id=eq.${enc(uid)}&select=salt,blob", null, access(c)) as JSONArray
            if (rows.length() == 0) { signOutQuiet(c); return "Sign in to Oto on your PC first. Your phone uses the same account key." }
            val row = rows.getJSONObject(0)
            val key = SCrypt.generate(password.toByteArray(Charsets.UTF_8), unb64(row.getString("salt")), 32768, 8, 1, 32)
            try { decrypt(row.getString("blob"), key) } catch (e: Exception) { signOutQuiet(c); return "Open Oto on your PC once. Its saved data still uses your old password." }
            prefs(c).edit().putString("email", email.trim()).putString("key", seal(b64(key))).apply()
            null
        } catch (e: LinkError) { e.message } catch (e: Exception) { "Couldn’t sign in (${e.javaClass.simpleName})" }
    }
    private fun signOutQuiet(c: Context) { prefs(c).edit().remove("uid").remove("key").remove("access").remove("refresh").apply() }

    // ------------------------------------------------------------ your Oto Card (from your PC, read only)
    /**
     * Background thread. Reads your synced Oto data, decrypts it with your key (on the phone, like the PC does) and
     * keeps only what the card needs: the card itself, XP stats, badges, the day you started and your spaces' colours.
     * Nothing is written back, so the phone can never change your PC's data. Returns the card JSON, or null.
     */
    fun pullCard(c: Context): JSONObject? {
        if (!signedIn(c)) return null
        val uid = prefs(c).getString("uid", "")!!
        val rows = http("GET", "/rest/v1/oto_sync?user_id=eq.${enc(uid)}&select=blob", null, access(c)) as JSONArray
        if (rows.length() == 0) return null
        val k = unseal(prefs(c).getString("key", null)) ?: throw LinkError("Please sign in again", auth = true)
        val all = decrypt(rows.getJSONObject(0).getString("blob"), unb64(k))
        val sec = all.optJSONObject("sections") ?: JSONObject()
        val card = sec.optJSONObject("card")?.optJSONObject("data") ?: JSONObject()
        val spaces = sec.optJSONObject("spaces")?.optJSONObject("data")?.optJSONArray("workspaces") ?: JSONArray()
        val settings = sec.optJSONObject("settings")?.optJSONObject("data")?.optJSONObject("settings") ?: JSONObject()
        val ws = JSONArray()
        for (i in 0 until minOf(spaces.length(), 40)) {
            val w = spaces.optJSONObject(i) ?: continue
            ws.put(JSONObject().put("id", w.opt("id")).put("colors", w.optJSONArray("colors") ?: JSONArray()).put("color", w.optString("color", "")))
        }
        val out = JSONObject()
            .put("card", card.optJSONObject("card") ?: JSONObject())
            .put("badges", card.optJSONObject("badges") ?: JSONObject())
            .put("xpBonus", card.optInt("xpBonus", 0))
            .put("since", card.optLong("since", 0))
            .put("stats", card.optJSONObject("stats") ?: JSONObject())
            .put("workspaces", ws)
            .put("userName", settings.optString("userName", ""))
            .put("at", all.optLong("at", 0))
        prefs(c).edit().putString("card", out.toString()).apply()
        return out
    }
    /** the card as last fetched (shown straight away; refreshed in the background) */
    fun savedCard(c: Context): JSONObject? = try { prefs(c).getString("card", null)?.let { JSONObject(it) } } catch (e: Exception) { null }

    // ------------------------------------------------------------ this phone ⇄ your PCs
    fun info(c: Context, tabs: List<Pair<String, String>>, active: String): JSONObject {
        val bm = c.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val name = try { Settings.Global.getString(c.contentResolver, Settings.Global.DEVICE_NAME) } catch (e: Exception) { null }
        val arr = JSONArray(); tabs.filter { it.first.startsWith("http") }.take(40).forEach { arr.put(JSONObject().put("u", it.first.take(1000)).put("t", it.second.take(140))) }
        return JSONObject()
            .put("name", (name?.takeIf { it.isNotBlank() } ?: Build.MODEL).take(40))
            .put("kind", "phone")
            .put("model", "${Build.MANUFACTURER} ${Build.MODEL}".take(60))
            .put("os", "Android ${Build.VERSION.RELEASE}")
            .put("app", BuildConfig.VERSION_NAME)
            .put("battery", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
            .put("charging", bm.isCharging)
            .put("tabs", arr).put("active", if (active.startsWith("http")) active.take(1000) else "")
            .put("at", System.currentTimeMillis())
    }

    /** Background thread: save this phone's row, read your other devices, and pick up tabs sent here. */
    fun beat(c: Context, me: JSONObject): Beat {
        val t = access(c); val key = devKey(c)
        val uid = prefs(c).getString("uid", "")!!; val id = deviceId(c)
        http("POST", "/rest/v1/oto_devices?on_conflict=user_id,device_id", JSONObject()
            .put("user_id", uid).put("device_id", id).put("kind", "phone").put("blob", encrypt(me, key))
            .put("updated_at", iso(System.currentTimeMillis())), t, "resolution=merge-duplicates,return=minimal")
        val rows = http("GET", "/rest/v1/oto_devices?user_id=eq.${enc(uid)}&select=device_id,kind,blob,updated_at&order=updated_at.desc", null, t) as JSONArray
        val devices = ArrayList<Device>()
        for (i in 0 until rows.length()) {
            val r = rows.getJSONObject(i); if (r.getString("device_id") == id) continue
            val d = try { decrypt(r.getString("blob"), key) } catch (e: Exception) { null }
            val tabs = ArrayList<Pair<String, String>>()
            d?.optJSONArray("tabs")?.let { a -> for (j in 0 until a.length()) a.optJSONObject(j)?.let { tabs.add(it.optString("u") to it.optString("t")) } }
            devices.add(Device(r.getString("device_id"), r.optString("kind"), d?.optString("name") ?: "Oto", parseIso(r.optString("updated_at")), tabs, d == null))
        }
        val box = http("GET", "/rest/v1/oto_inbox?user_id=eq.${enc(uid)}&to_device=eq.${enc(id)}&select=id,blob&order=id.asc", null, t) as JSONArray
        val inbox = ArrayList<Sent>()
        for (i in 0 until box.length()) try { val m = decrypt(box.getJSONObject(i).getString("blob"), key); inbox.add(Sent(m.optString("u"), m.optString("t"), m.optString("from"))) } catch (e: Exception) {}
        if (box.length() > 0) try { http("DELETE", "/rest/v1/oto_inbox?user_id=eq.${enc(uid)}&to_device=eq.${enc(id)}&id=lte.${box.getJSONObject(box.length() - 1).get("id")}", null, t) } catch (e: Exception) {}
        return Beat(devices, inbox)
    }

    fun send(c: Context, deviceId: String, url: String, title: String, from: String) {
        val uid = prefs(c).getString("uid", "")!!
        http("POST", "/rest/v1/oto_inbox", JSONObject().put("user_id", uid).put("to_device", deviceId)
            .put("blob", encrypt(JSONObject().put("u", url.take(2000)).put("t", title.take(200)).put("from", from), devKey(c))), access(c), "return=minimal")
    }

    private fun iso(ms: Long): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(ms))
    private fun parseIso(s: String): Long = try { java.time.OffsetDateTime.parse(s).toInstant().toEpochMilli() } catch (e: Exception) { 0L }
}
