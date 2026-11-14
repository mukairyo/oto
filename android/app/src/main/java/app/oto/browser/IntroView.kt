package app.oto.browser

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.SystemClock
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The Oto startup, drawn natively so it plays before the web engine has even started:
 * a galaxy forms out of swirling star dust (two arms, r = a·e^(bθ)), the orbits appear,
 * the white hole ignites on the boom of the startup sound, a shockwave and a warp of stars
 * rush past, then 音 and OTO settle in. About two seconds, same timing as Oto on Windows.
 */
class IntroView(context: Context, private val onDone: () -> Unit) : View(context) {
    private val t0 = SystemClock.uptimeMillis()
    private val d = resources.displayMetrics.density
    private var finished = false

    private class Dot(val x: Float, val y: Float, val r: Float, val a: Float, val warm: Float)
    private class Star(val x: Float, val y: Float, val z0: Float, val w: Float, val warm: Float)

    private val galaxy = ArrayList<Dot>()
    private val field = ArrayList<Dot>()
    private val warp = ArrayList<Star>()
    private var seed = 4242L
    private fun rnd(): Float { seed = (seed * 16807) % 2147483647; return seed / 2147483647f }
    private fun gauss(): Float { var u = 0f; repeat(4) { u += rnd() }; return (u - 2f) / 1.15f }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val kanji = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFECE8E1.toInt(); textAlign = Paint.Align.CENTER; textSize = 30 * d; typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL) }
    private val word = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x80ECE8E1.toInt(); textAlign = Paint.Align.CENTER; textSize = 11 * d; typeface = Typeface.MONOSPACE }

    init {
        // galaxy: two spiral arms of star dust + dust between them (logo units, centre 0,0)
        val a = 1.5f; val b = 0.3f; val rm = 27f; val tm = ln(rm / a) / b
        for (arm in 0..1) {
            val off = arm * PI.toFloat()
            repeat(210) {
                val t = rnd().pow(0.85f) * tm
                val r = a * exp(b * t) * (1 + gauss() * 0.07f)
                val w = r / rm
                val ang = t + off + gauss() * (0.16f + 0.12f * w)
                galaxy += Dot(r * cos(ang), r * sin(ang), (0.16f + rnd() * 0.42f) * (1 - 0.35f * w), (0.45f + rnd() * 0.55f) * (1 - 0.45f * w), w)
            }
        }
        repeat(110) {
            val r = min(rm, -ln(1 - rnd() * 0.98f) * 7f); val ang = rnd() * 2 * PI.toFloat(); val w = r / rm
            galaxy += Dot(r * cos(ang), r * sin(ang), 0.12f + rnd() * 0.22f, (0.25f + rnd() * 0.4f) * (1 - 0.5f * w), w)
        }
        // background stars (screen fractions)
        seed = 2026L
        repeat(260) { field += Dot(rnd(), rnd(), 0.35f + rnd() * 0.9f, 0.2f + rnd() * 0.55f, rnd()) }
        // warp stars (3D field)
        seed = 7L
        repeat(140) {
            var x: Float; var y: Float
            do { x = rnd() * 2 - 1; y = rnd() * 2 - 1 } while (hypot(x, y) < 0.06f || hypot(x, y) > 1f)
            warp += Star(x, y, rnd(), 0.6f + rnd() * 0.8f, rnd())
        }
        setBackgroundColor(0xFF0A0A0B.toInt())
        isClickable = true
    }

    private fun clamp(v: Float, lo: Float = 0f, hi: Float = 1f) = max(lo, min(hi, v))
    private fun easeOut(x: Float) = 1 - (1 - clamp(x)).pow(3)
    private fun easeInOut(x: Float): Float { val c = clamp(x); return if (c < 0.5f) 4 * c * c * c else 1 - (-2 * c + 2).pow(3) / 2 }

    // warp distance travelled: a burst on the boom, then a calm drift
    private fun warpS(t: Float): Float {
        val t0 = 0.7f; val aa = 3.4f; val tau = 0.3f; val bb = 0.22f
        return if (t <= t0) 0f else aa * tau * (1 - exp(-(t - t0) / tau)) + bb * (t - t0)
    }

    override fun onDraw(canvas: Canvas) {
        val t = (SystemClock.uptimeMillis() - t0) / 1000f
        val w = width.toFloat(); val h = height.toFloat()
        val cx = w / 2; val cy = h * 0.44f
        val unit = min(w, h) * 0.62f / 64f          // logo units → pixels
        val out = clamp((t - 1.95f) / 0.4f)          // fade out at the end
        val master = 1 - out

        // background stars fade up
        val skyA = clamp(t / 0.7f) * master
        paint.shader = null
        for (s in field) {
            paint.color = if (s.warm < 0.2f) 0xFFFFE7C4.toInt() else if (s.warm > 0.85f) 0xFFDFE8FF.toInt() else 0xFFFFFAF2.toInt()
            paint.alpha = (255 * s.a * skyA).toInt()
            canvas.drawCircle(s.x * w, s.y * h, s.r * d * 0.8f, paint)
        }

        canvas.save()
        canvas.translate(cx, cy)
        canvas.rotate(-6f)

        // orbits (faint dashed rings) appear from the middle out
        for (i in 0 until 11) {
            val k = clamp((t - 0.3f - i * 0.04f) / 0.7f); if (k <= 0f) continue
            val tt = i / 10f; val r = (6.5f + tt * 21f) * unit * (0.55f + 0.45f * easeOut(k))
            val rx = r; val ry = r * 0.46f
            val circ = (PI * (3 * (rx + ry) - sqrt((3 * rx + ry) * (rx + 3 * ry)))).toFloat()
            stroke.pathEffect = DashPathEffect(floatArrayOf(circ * 0.26f, circ * 0.06f, circ * 0.2f, circ * 0.05f), (t * 10f * (11 - i)) % circ)
            stroke.strokeWidth = (1.05f - tt * 0.55f) * unit
            stroke.color = 0xFFF2EDE3.toInt()
            stroke.alpha = (255 * 0.26f * easeOut(k) * (0.95f - tt * 0.45f) * master).toInt()
            canvas.drawOval(RectF(-rx, -ry, rx, ry), stroke)
        }
        stroke.pathEffect = null

        // galaxy forming: swirls in from far out, settles, keeps turning
        val gk = easeInOut(t / 1.3f)
        val rot = 300f * (1 - gk) - max(0f, t - 1.3f) * 9f
        val gs = 3f - 2f * gk
        val ga = clamp(t / 0.4f) * 0.6f + 0.4f * gk
        canvas.save()
        canvas.scale(1f, 0.46f)
        canvas.rotate(rot)
        canvas.scale(gs * unit, gs * unit)
        for (p in galaxy) {
            paint.color = colorFor(p.warm)
            paint.alpha = (255 * p.a * ga * master).toInt()
            canvas.drawCircle(p.x, p.y, p.r, paint)
        }
        canvas.restore()

        // the white hole ignites at 0.75 s (the boom)
        val bt = (t - 0.35f) / 0.95f
        if (bt > 0f) {
            val sc = if (bt < 0.45f) 0.3f + (2.4f - 0.3f) * easeOut(bt / 0.45f) else 2.4f - 1.4f * easeOut((bt - 0.45f) / 0.55f)
            val ca = clamp(bt / 0.2f) * master
            val rx = 10f * unit * sc; val ry = 6.5f * unit * sc
            paint.shader = RadialGradient(0f, 0f, rx, intArrayOf(0xFFFFFFFF.toInt(), 0xF2FFF6E8.toInt(), 0x59E7DFD1, 0x00E7DFD1), floatArrayOf(0f, 0.25f, 0.6f, 1f), Shader.TileMode.CLAMP)
            paint.alpha = (255 * ca).toInt()
            canvas.save(); canvas.scale(1f, ry / rx); canvas.drawCircle(0f, 0f, rx, paint); canvas.restore()
            paint.shader = null
            paint.color = 0xFFFFFFFF.toInt(); paint.alpha = (255 * clamp((t - 0.5f) / 0.25f) * master).toInt()
            canvas.drawCircle(0f, 0f, 1.8f * unit, paint)
        }

        // shockwave
        val sk = (t - 0.72f) / 0.95f
        if (sk in 0f..1f) {
            val e = easeOut(sk); val rx = (10f + 250f * e) * d; val ry = rx * 0.44f
            stroke.strokeWidth = 1.2f * d
            stroke.color = 0xFFFFF6E8.toInt(); stroke.alpha = (255 * (if (sk < 0.1f) sk / 0.1f else 1 - sk) * 0.9f).toInt()
            canvas.drawOval(RectF(-rx, -ry, rx, ry), stroke)
        }
        canvas.restore()

        // warp: stars fly out of the white hole toward you and stretch as they pass
        val env = clamp((t - 0.68f) / 0.1f) * clamp(1 - (t - 1.45f) / 0.45f)
        if (env > 0f) {
            val f = max(w, h) * 0.42f; val s1 = warpS(t); val s0 = warpS(t - 0.045f)
            for (p in warp) {
                val z1 = 0.03f + (((p.z0 - s1) % 1f + 1f) % 1f) * 0.97f
                val z0 = 0.03f + (((p.z0 - s0) % 1f + 1f) % 1f) * 0.97f
                if (z0 < z1) continue
                val x1 = cx + p.x / z1 * f; val y1 = cy + p.y / z1 * f * 0.8f
                val x0 = cx + p.x / z0 * f; val y0 = cy + p.y / z0 * f * 0.8f
                val near = 1 - z1; val dist = hypot(x1 - cx, y1 - cy)
                val al = 0.8f * env * min(1f, near * 1.5f) * min(1f, dist / (150f * d / 2f))
                if (al <= 0.01f) continue
                stroke.color = if (p.warm > 0.5f) 0xFFFFF5E8.toInt() else 0xFFFFF0DE.toInt()
                stroke.alpha = (255 * al).toInt()
                stroke.strokeWidth = p.w * (0.35f + near * 1.8f) * d * 0.7f
                canvas.drawLine(x0, y0, x1, y1, stroke)
            }
        }

        // 音 and OTO
        val ty = cy + 26f * unit
        val lk = easeOut((t - 0.75f) / 0.55f)
        if (lk > 0f) {
            stroke.strokeWidth = 1f * d; stroke.color = 0x66E7DFD1; stroke.alpha = (0x66 * master).toInt()
            val half = 32f * d * lk
            canvas.drawLine(cx - 24f * d - half, ty - 10f * d, cx - 24f * d, ty - 10f * d, stroke)
            canvas.drawLine(cx + 24f * d, ty - 10f * d, cx + 24f * d + half, ty - 10f * d, stroke)
        }
        val kk = clamp((t - 0.85f) / 0.5f)
        if (kk > 0f) { kanji.alpha = (255 * kk * master).toInt(); canvas.drawText("音", cx, ty, kanji) }
        val wk = clamp((t - 1f) / 0.6f)
        if (wk > 0f) {
            word.alpha = (0x80 * wk * master).toInt()
            word.letterSpacing = 0.1f + 0.5f * wk
            canvas.drawText("OTO", cx, ty + 22f * d, word)
        }

        alpha = master
        if (t < 2.4f) postInvalidateOnAnimation() else if (!finished) { finished = true; post { onDone() } }
    }

    private fun colorFor(w: Float): Int {
        val k = min(1f, w)
        val r = (255 - 40 * k).toInt(); val g = (246 - 22 * k).toInt(); val b = (232 - 2 * k).toInt()
        return (0xFF shl 24) or (r shl 16) or (g shl 8) or b
    }
}
