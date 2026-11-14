package app.oto.browser

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * The same space as the Oto website behind the tab window: the black sky (#030304) with the site's own starfield
 * (res/drawable-nodpi/space.webp = site/img/space.webp, tiled at the same size), drifting a little as you scroll, and
 * a shooting star now and then like on the site. Opening the window comes out of warp: stars rush in as streaks from
 * the middle and the starfield appears as they settle.
 */
class SpaceSky(private val ctx: Context) {
    private class Star(val x: Float, val y: Float, val r: Float, val color: Int, val a: Float)

    private val d = ctx.resources.displayMetrics.density
    private var w = 0
    private var h = 0
    private val warpStars = ArrayList<Star>()
    private val streak = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private val flash = Paint(Paint.ANTI_ALIAS_FLAG)
    private val field = Paint(Paint.FILTER_BITMAP_FLAG)
    private val fieldMatrix = Matrix()
    private var tile: Bitmap? = null
    private var fieldIn = 0L // when the starfield picture became ready
    private val born = SystemClock.uptimeMillis()
    private var seed = 2026L
    private fun rnd(): Float { seed = (seed * 16807) % 2147483647; return seed / 2147483647f }
    private val rand = java.util.Random()

    /** how far the list is scrolled (the starfield drifts with it, like the website) */
    var scrollY = 0f

    // the site's shooting stars
    private var meteorAt = 0L
    private var mStart = -1L
    private var mx = 0f; private var my = 0f; private var ma = 0f; private var mv = 0f; private var mMax = 1f

    companion object {
        const val WARP = 760L
        const val NIGHT = 0xFF030304.toInt()
    }

    init {
        // the site's starfield, decoded off the main thread while the warp plays
        thread {
            val b = try {
                BitmapFactory.decodeResource(ctx.resources, R.drawable.space, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565; inScaled = false })
            } catch (e: Throwable) { null }
            if (b != null) Handler(Looper.getMainLooper()).post {
                tile = b
                // the website shows the 2400 px picture as a 1200 px tile
                field.shader = BitmapShader(b, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
                fieldIn = SystemClock.uptimeMillis()
            }
        }
        meteorAt = born + WARP + 2500 + (rand.nextFloat() * 3000).toLong()
    }

    fun size(width: Int, height: Int) {
        if (width == w && height == h) return
        w = width; h = height
        seed = 2026L; warpStars.clear()
        val n = ((w / d) * (h / d) / 1500f).toInt().coerceIn(100, 320)
        repeat(n) {
            val big = rnd() < 0.05f
            val warm = rnd()
            val col = if (warm < 0.2f) 0xFFFFE7C4.toInt() else if (warm > 0.85f) 0xFFDFE8FF.toInt() else 0xFFFFFAF2.toInt()
            warpStars.add(Star(rnd() * w, rnd() * h, (if (big) 1.0f + rnd() * 0.8f else 0.35f + rnd() * 0.5f) * d, col, 0.35f + rnd() * 0.6f))
        }
    }

    fun release() { tile?.recycle(); tile = null; field.shader = null }

    /** Draw the sky. Returns how long until it next needs drawing (0 = every frame). */
    fun draw(c: Canvas): Long {
        c.drawColor(NIGHT)
        if (w <= 0 || h <= 0) return 100
        val now = SystemClock.uptimeMillis()
        val t = min(1f, (now - born) / WARP.toFloat())
        val e = 1f - (1f - t) * (1f - t) * (1f - t)

        // the website's starfield (fades in as the warp ends)
        val tb = tile
        var fieldA = 0f
        if (tb != null && !tb.isRecycled) {
            fieldA = min(1f, max(0f, (e - 0.55f) / 0.45f)) * min(1f, (now - fieldIn) / 300f)
            val sc = (1200f * d) / tb.width
            fieldMatrix.setScale(sc, sc)
            fieldMatrix.postTranslate(0f, -min(scrollY, 20000f * d) * 0.035f)
            field.shader?.setLocalMatrix(fieldMatrix)
            field.alpha = (255 * fieldA).toInt()
            if (fieldA > 0f) c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), field)
        }

        if (t < 1f || fieldA < 1f) {
            // coming out of warp: every star a streak from the middle that shrinks to a point and gives way to the starfield
            val cx = w / 2f; val cy = h * 0.46f
            val tail = 0.82f * (1f - e)
            val push = 0.3f + 0.7f * e
            val fade = min(1f, t / 0.12f) * (1f - fieldA)
            for (s in warpStars) {
                val dx = (s.x - cx) * push; val dy = (s.y - cy) * push
                streak.color = s.color; streak.alpha = (255 * s.a * fade).toInt(); streak.strokeWidth = s.r * 1.6f
                c.drawLine(cx + dx * (1f - tail), cy + dy * (1f - tail), cx + dx, cy + dy, streak)
            }
            if (t < 1f) {
                flash.shader = RadialGradient(cx, cy, max(w, h) * 0.5f, Color.argb((150 * (1f - t) * (1f - t)).toInt(), 255, 246, 232), 0, Shader.TileMode.CLAMP)
                c.drawCircle(cx, cy, max(w, h) * 0.5f, flash)
            }
            return if (t < 1f || tb != null) 0 else 200 // (the picture couldn't be read: the warp's stars stay)
        }

        // a shooting star now and then, like on the website (from the left or the right, fading in and out)
        if (now >= meteorAt) {
            if (mStart < 0) {
                val fromLeft = rand.nextFloat() < 0.5f
                ma = ((if (fromLeft) 0.35 else PI - 0.35) + (rand.nextFloat() - 0.5f) * 0.4f).toFloat()
                mx = w * (if (fromLeft) rand.nextFloat() * 0.6f else 0.4f + rand.nextFloat() * 0.6f)
                my = h * rand.nextFloat() * 0.45f
                mv = (600f + rand.nextFloat() * 400f) * d
                mMax = 0.9f + rand.nextFloat() * 0.5f
                mStart = now
            }
            val life = (now - mStart) / 1000f
            if (life >= mMax) { mStart = -1L; meteorAt = now + 5000 + (rand.nextFloat() * 9000).toLong(); return 500 }
            val k = life / mMax
            val fade = if (k < 0.15f) k / 0.15f else 1f - (k - 0.15f) / 0.85f
            val x = mx + cos(ma) * mv * life; val y = my + sin(ma) * mv * life
            val len = (95f + 55f * fade) * d
            val tx = x - cos(ma) * len; val ty = y - sin(ma) * len
            streak.shader = LinearGradient(x, y, tx, ty, Color.argb((230 * fade).toInt(), 255, 248, 236), Color.argb(0, 255, 248, 236), Shader.TileMode.CLAMP)
            streak.alpha = 255; streak.strokeWidth = 1.4f * d
            c.drawLine(x, y, tx, ty, streak)
            streak.shader = null
            return 0
        }
        return min(500L, meteorAt - now).coerceAtLeast(16L)
    }
}
