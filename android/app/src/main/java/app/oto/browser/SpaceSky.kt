package app.oto.browser

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.os.SystemClock
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Outer space behind the tab window, with the colours of the galaxy on Oto for Windows (galaxyBg in logo.js): a dark
 * sky, the Milky Way band with violet, teal and copper nebulae, a few hundred warm and cool stars, some of them twinkling,
 * and now and then a shooting star. Opening the window comes out of warp: the stars rush in as streaks and settle.
 */
class SpaceSky(private val d: Float) {
    private class Star(val x: Float, val y: Float, val r: Float, val color: Int, val a: Float, val tw: Float, val ph: Float)

    private var w = 0
    private var h = 0
    private val stars = ArrayList<Star>()
    private var sky: Bitmap? = null
    private val dot = Paint(Paint.ANTI_ALIAS_FLAG)
    private val streak = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private val img = Paint(Paint.FILTER_BITMAP_FLAG)
    private val flash = Paint(Paint.ANTI_ALIAS_FLAG)
    private val born = SystemClock.uptimeMillis()
    private var seed = 2026L
    private fun rnd(): Float { seed = (seed * 16807) % 2147483647; return seed / 2147483647f }

    // a shooting star now and then
    private var shootAt = 0L
    private var sx = 0f; private var sy = 0f; private var sa = 0f
    private var shootStart = -1L

    companion object { const val WARP = 760L }

    fun size(width: Int, height: Int) {
        if (width == w && height == h) return
        w = width; h = height
        if (w <= 0 || h <= 0) return
        seed = 2026L; stars.clear()
        val bandAt = { x: Float -> h * 0.62f - (x / w) * h * 0.34f } // low-left to high-right, like on Windows
        val n = ((w / d) * (h / d) / 1250f).toInt().coerceIn(120, 420)
        repeat(n) {
            val x = rnd() * w
            val inBand = rnd() < 0.55f
            val y = if (inBand) bandAt(x) + (rnd() + rnd() + rnd() - 1.5f) * h * 0.16f else rnd() * h
            val big = rnd() < 0.04f
            val r = (if (big) 1.0f + rnd() * 0.9f else 0.3f + rnd() * 0.55f) * d
            val warm = rnd()
            val col = if (warm < 0.2f) 0xFFFFE7C4.toInt() else if (warm > 0.85f) 0xFFDFE8FF.toInt() else 0xFFFFFAF2.toInt()
            val a = 0.35f + rnd() * 0.6f
            val tw = if (rnd() < 0.16f) 0.6f + rnd() * 1.2f else 0f
            stars.add(Star(x, y, r, col, a, tw, rnd() * 6.28f))
        }
        sky?.recycle()
        sky = paintSky(bandAt)
        shootAt = SystemClock.uptimeMillis() + WARP + 2500 + (rnd() * 4000).toLong()
    }

    /** The sky itself (drawn small once and stretched: it's all soft glow). */
    private fun paintSky(bandAt: (Float) -> Float): Bitmap? = try {
        val k = 4
        val bw = max(1, w / k); val bh = max(1, h / k)
        val b = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.scale(1f / k, 1f / k)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = RadialGradient(w * 0.5f, h * 0.46f, max(w, h) * 0.75f, 0xFF121216.toInt(), 0xFF070708.toInt(), Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
        val ang = (-atan2(h * 0.34f, w.toFloat()) * 180 / PI).toFloat()
        fun blob(cx: Float, cy: Float, rx: Float, ry: Float, rot: Float, col: Int, op: Float) {
            c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(1f, ry / rx)
            val a = (op * 255 * 1.7f).toInt().coerceAtMost(255)
            p.shader = RadialGradient(0f, 0f, rx, Color.argb(a, Color.red(col), Color.green(col), Color.blue(col)), Color.argb(0, Color.red(col), Color.green(col), Color.blue(col)), Shader.TileMode.CLAMP)
            c.drawCircle(0f, 0f, rx, p)
            c.restore()
        }
        val W = w.toFloat(); val H = h.toFloat()
        blob(W * 0.5f, bandAt(W * 0.5f), W * 0.9f, H * 0.16f, ang, 0xE9DCC6, 0.10f)
        blob(W * 0.52f, bandAt(W * 0.52f), W * 0.6f, H * 0.07f, ang, 0xFFF1D8, 0.11f)
        blob(W * 0.22f, bandAt(W * 0.22f) + H * 0.05f, W * 0.45f, H * 0.14f, ang + 8, 0x7D5F9C, 0.22f)
        blob(W * 0.8f, bandAt(W * 0.8f) - H * 0.04f, W * 0.45f, H * 0.13f, ang - 6, 0x3F6F86, 0.22f)
        blob(W * 0.62f, bandAt(W * 0.62f) + H * 0.06f, W * 0.3f, H * 0.09f, ang, 0x9C6A48, 0.16f)
        blob(W * 0.45f, bandAt(W * 0.45f) + H * 0.015f, W * 0.5f, H * 0.025f, ang + 1, 0x060607, 0.5f)
        blob(W * 0.7f, bandAt(W * 0.7f) - H * 0.01f, W * 0.28f, H * 0.018f, ang - 2, 0x060607, 0.4f)
        b
    } catch (e: Throwable) { null }

    /** Draw the sky. Returns true while it's moving fast (warp or a shooting star) and wants every frame. */
    fun draw(c: Canvas): Boolean {
        if (w <= 0 || h <= 0) { c.drawColor(MainActivity.BG); return false }
        val now = SystemClock.uptimeMillis()
        val t = min(1f, (now - born) / WARP.toFloat())
        val e = 1f - (1f - t) * (1f - t) * (1f - t)
        c.drawColor(0xFF070708.toInt())
        sky?.let { img.alpha = (255 * (0.25f + 0.75f * e)).toInt(); c.drawBitmap(it, null, android.graphics.RectF(0f, 0f, w.toFloat(), h.toFloat()), img) }
        val cx = w / 2f; val cy = h * 0.46f
        val secs = now / 1000f
        if (t < 1f) {
            // coming out of warp: every star a streak from the middle that shrinks into its place
            val tail = 0.82f * (1f - e)
            val push = 0.3f + 0.7f * e
            val fade = min(1f, t / 0.12f)
            for (s in stars) {
                val dx = (s.x - cx) * push; val dy = (s.y - cy) * push
                streak.color = s.color; streak.alpha = (255 * s.a * fade).toInt(); streak.strokeWidth = s.r * 1.6f
                c.drawLine(cx + dx * (1f - tail), cy + dy * (1f - tail), cx + dx, cy + dy, streak)
            }
            flash.shader = RadialGradient(cx, cy, max(w, h) * 0.5f, Color.argb((150 * (1f - t) * (1f - t)).toInt(), 255, 246, 232), 0, Shader.TileMode.CLAMP)
            c.drawCircle(cx, cy, max(w, h) * 0.5f, flash)
            return true
        }
        for (s in stars) {
            var a = s.a
            if (s.tw > 0f) a *= 0.55f + 0.45f * sin(secs * s.tw + s.ph)
            dot.color = s.color; dot.alpha = (255 * a).toInt()
            c.drawCircle(s.x, s.y, s.r, dot)
            if (s.r > 0.95f * d) { dot.alpha = (40 * a).toInt(); c.drawCircle(s.x, s.y, s.r * 3.2f, dot) }
        }
        // a shooting star
        if (now >= shootAt) {
            if (shootStart < 0) { shootStart = now; sx = w * (0.3f + rnd() * 0.65f); sy = h * (0.05f + rnd() * 0.35f); sa = (PI * (0.72f + rnd() * 0.12f)).toFloat() }
            val p = (now - shootStart) / 650f
            if (p >= 1f) { shootStart = -1L; shootAt = now + 5000 + (rnd() * 6000).toLong(); return false }
            val len = 70 * d; val run = 160 * d * p
            val hx = sx + cos(sa) * run; val hy = sy + sin(sa) * run
            for (i in 0 until 8) {
                val f0 = i / 8f; val f1 = (i + 1) / 8f
                streak.color = 0xFFFFFAF2.toInt(); streak.strokeWidth = 1.4f * d * (1f - f0)
                streak.alpha = (230 * (1f - f0) * sin(PI.toFloat() * p)).toInt().coerceAtLeast(0)
                c.drawLine(hx - cos(sa) * len * f0, hy - sin(sa) * len * f0, hx - cos(sa) * len * f1, hy - sin(sa) * len * f1, streak)
            }
            return true
        }
        return false
    }
}
