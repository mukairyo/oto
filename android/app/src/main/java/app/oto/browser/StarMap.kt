package app.oto.browser

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.os.SystemClock
import android.text.TextPaint
import android.text.TextUtils
import android.util.TypedValue
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.OverScroller
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Your tabs as a star map. Every tab is a star; the tabs of one site make up a constellation with its own shape
 * (made up from the site's name, so it's always the same) and the site's name written beside it, like on a star chart.
 * The sky is bigger than the screen: drag to look around, pinch to see more. A new tab appears somewhere in the sky as
 * a shooting star, and until you've found it an arrow at the edge points the way.
 */
@SuppressLint("ViewConstructor")
class StarMap(
    ctx: Context,
    private val onOpen: (Int) -> Unit,
    private val onHold: (DrawerItem, Float, Float) -> Unit,
    /** the view moved: where the sky should be (for the stars far behind) */
    private val onMove: (Float, Float) -> Unit,
) : View(ctx) {

    private val d = resources.displayMetrics.density
    private fun px(v: Float) = v * d
    private fun sp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, v, resources.displayMetrics)

    private class StarPt(val item: DrawerItem, val x: Float, val y: Float, val parent: Int, val label: String)
    private class Group(val host: String, val name: String, val stars: ArrayList<StarPt>, val bits: FloatArray)

    private var items: List<DrawerItem> = emptyList()
    private val groups = ArrayList<Group>()
    private var worldW = 0f
    private var worldH = 0f
    private var query = ""

    // view: screen = world * zoom - (vx, vy)
    private var vx = 0f
    private var vy = 0f
    private var zoom = 1f
    private var placed = false
    private val born = SystemClock.uptimeMillis()
    private var glide: ValueAnimator? = null
    private val scroller = OverScroller(ctx)
    private var fading = -1 // the item index being closed
    private var fadeT = 0f
    private val arrivals = HashMap<Int, Long>() // item index → when it started flying in

    // paints
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = 0x8CECE8E1.toInt(); strokeWidth = px(1.1f); strokeCap = Paint.Cap.ROUND }
    private val dust = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xB3FFFAF2.toInt() }
    private val core = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFAF2.toInt() }
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = px(1.2f) }
    private val tStar = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(8.5f); letterSpacing = 0.1f; textAlign = Paint.Align.CENTER }
    private val tName = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.SERIF, Typeface.ITALIC); textSize = sp(17f); color = 0xE6EFE7D8.toInt(); textAlign = Paint.Align.CENTER }
    private val tNew = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(8f); letterSpacing = 0.14f; color = 0xE6E68C6E.toInt(); textAlign = Paint.Align.CENTER }
    private val arrow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xF2D66042.toInt() }
    private val trail = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }

    // the small windows that show what's inside a star
    private var dragWin: StarPt? = null
    private var dragX0 = 0f
    private var dragY0 = 0f
    private var dragOff0 = floatArrayOf(0f, 0f)
    private var dragMoved = false
    private val touchSlop = android.view.ViewConfiguration.get(ctx).scaledTouchSlop
    private val winA = HashMap<Int, Float>()          // item index → how visible its window is (eases in and out)
    private val winRect = HashMap<Int, android.graphics.RectF>()
    private val winFill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val winLine = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = px(1f) }
    private val winPic = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val tHud = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(7f); letterSpacing = 0.14f }
    private val scan = Paint()
    private val tWinBig = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL); textSize = sp(30f); color = 0x33ECE8E1; textAlign = Paint.Align.CENTER }
    private val tWinHint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(7f); letterSpacing = 0.1f; color = 0x61ECE8E1; textAlign = Paint.Align.CENTER }
    private val sparkle = Path().apply {
        // a four-pointed star, like the stars on a chart (unit size)
        moveTo(0f, -1f); quadTo(0f, 0f, 1f, 0f); quadTo(0f, 0f, 0f, 1f); quadTo(0f, 0f, -1f, 0f); quadTo(0f, 0f, 0f, -1f); close()
    }
    private val glowWarm = RadialGradient(0f, 0f, 1f, intArrayOf(0xFFFFF3DC.toInt(), 0x55FFF3DC, 0x00FFF3DC), floatArrayOf(0f, 0.25f, 1f), Shader.TileMode.CLAMP)
    private val glowCool = RadialGradient(0f, 0f, 1f, intArrayOf(0xFFE8EEFF.toInt(), 0x55E8EEFF, 0x00E8EEFF), floatArrayOf(0f, 0.25f, 1f), Shader.TileMode.CLAMP)

    companion object {
        private const val CELL = 250f // dp
        private const val CYAN = 0xFF7FE3FF.toInt()
        /** windows you've dragged somewhere: they stay open where you put them (for as long as Oto is open) */
        private val pinned = HashMap<String, FloatArray>()
        private fun pinKey(i: DrawerItem) = i.host + "|" + i.title
        private fun hash(s: String) = s.hashCode()
        /** the same little random numbers every time for the same seed */
        private class Rng(seed: Int) {
            private var s: Long = (abs(seed.toLong()) % 2147483646L) + 1
            fun next(): Float { s = (s * 16807) % 2147483647; return s / 2147483647f }
        }

        /** "youtube.com" → "Youtube", "bbc.co.uk" → "Bbc", "oto" → "Oto" */
        fun constellationName(host: String): String {
            if (host == "oto") return "Oto"
            if (host == "oto card") return "Oto Card"
            val p = host.split('.').filter { it.isNotEmpty() }
            val core = when {
                p.size >= 3 && p[p.size - 2].length <= 3 -> p[p.size - 3]
                p.size >= 2 -> p[p.size - 2]
                else -> host
            }
            return core.replaceFirstChar { it.uppercaseChar() }
        }
    }

    private val gestures = GestureDetector(ctx, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent): Boolean { scroller.forceFinished(true); glide?.cancel(); return true }
        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean { moveTo(vx + dx, vy + dy); return true }
        override fun onFling(e1: MotionEvent?, e2: MotionEvent, velX: Float, velY: Float): Boolean {
            val (minX, maxX, minY, maxY) = bounds()
            scroller.fling(vx.toInt(), vy.toInt(), -velX.toInt(), -velY.toInt(), minX.toInt(), maxX.toInt(), minY.toInt(), maxY.toInt())
            postInvalidateOnAnimation(); return true
        }
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            arrowHit(e.x, e.y)?.let { glideTo(it); return true }
            windowAt(e.x, e.y)?.let { s -> onOpen(s.item.index); return true }
            starAt(e.x, e.y)?.let { s -> onOpen(s.item.index) }
            return true
        }
        override fun onLongPress(e: MotionEvent) {
            val s = starAt(e.x, e.y) ?: return
            performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            val (sx, sy) = screenOf(s)
            onHold(s.item, sx, sy)
        }
    })

    private val pinch = ScaleGestureDetector(ctx, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(g: ScaleGestureDetector): Boolean {
            val nz = (zoom * g.scaleFactor).coerceIn(0.5f, 1.7f)
            val wx = (g.focusX + vx) / zoom; val wy = (g.focusY + vy) / zoom
            zoom = nz
            moveTo(wx * zoom - g.focusX, wy * zoom - g.focusY)
            return true
        }
    })

    // ------------------------------------------------------------------ data
    fun show(list: List<DrawerItem>, removed: Int = -1) {
        items = list
        layoutSky()
        list.filter { it.drop }.forEach { arrivals[it.index] = SystemClock.uptimeMillis() + if (placed) 80L else SpaceSky.WARP }
        if (!placed && width > 0) place()
        val newOne = list.lastOrNull { it.drop }
        if (placed && newOne != null && removed < 0) postDelayed({ star(newOne.index)?.let { glideTo(it) } }, 120)
        invalidate()
    }

    fun search(q: String) {
        query = q.trim().lowercase()
        if (query.isNotEmpty()) matches().firstOrNull()?.let { glideTo(it) }
        invalidate()
    }

    fun firstMatch(): DrawerItem? = (if (query.isEmpty()) emptyList() else matches()).firstOrNull()?.item

    fun setThumb(index: Int, b: Bitmap) { items.firstOrNull { it.index == index }?.thumb = b }

    /** Fly to the tab you're on. */
    fun home() { current()?.let { glideTo(it) } }

    /** The star of a closing tab fades out, then [then] runs. */
    fun fadeOut(index: Int, then: () -> Unit) {
        fading = index
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 220
            addUpdateListener { fadeT = it.animatedValue as Float; invalidate() }
            addListener(object : android.animation.AnimatorListenerAdapter() { override fun onAnimationEnd(a: android.animation.Animator) { fading = -1; then() } })
            start()
        }
    }

    private fun matches(): List<StarPt> {
        val words = query.split(Regex("\\s+")).filter { it.isNotEmpty() }
        return groups.flatMap { it.stars }.filter { s -> val t = (s.item.title + " " + s.item.host).lowercase(); words.all { t.contains(it) } }
    }
    private fun isMatch(s: StarPt): Boolean {
        if (query.isEmpty()) return true
        val t = (s.item.title + " " + s.item.host).lowercase()
        return query.split(Regex("\\s+")).filter { it.isNotEmpty() }.all { t.contains(it) }
    }

    private fun current() = groups.flatMap { it.stars }.firstOrNull { it.item.current }
    private fun star(index: Int) = groups.flatMap { it.stars }.firstOrNull { it.item.index == index }

    /** Each site gets a place in the sky (from its name) and a constellation shape (from its name and how many tabs). */
    private fun layoutSky() {
        groups.clear()
        val byHost = LinkedHashMap<String, ArrayList<DrawerItem>>()
        items.forEach { byHost.getOrPut(it.host) { ArrayList() }.add(it) }
        val cols = max(2, ceil(sqrt(byHost.size * 1.3)).toInt())
        val rows = cols + 1
        val cell = px(CELL)
        worldW = cols * cell; worldH = rows * cell
        val used = HashSet<Int>()
        tStar.textSize = sp(8.5f)
        byHost.forEach { (host, tabs) ->
            var i = abs(hash(host) % (cols * rows))
            while (i in used) i = (i + 1) % (cols * rows)
            used.add(i)
            val r = Rng(hash(host) xor 0x5bd1)
            val cx = (i % cols + 0.5f) * cell + (r.next() - 0.5f) * px(40f)
            val cy = (i / cols + 0.5f) * cell + (r.next() - 0.5f) * px(40f)
            val pts = shape(host, tabs.size)
            val stars = ArrayList<StarPt>()
            tabs.forEachIndexed { k, t ->
                val label = TextUtils.ellipsize(t.title.uppercase(), tStar, px(120f), TextUtils.TruncateAt.END).toString()
                stars.add(StarPt(t, cx + px(pts[k][0]), cy + px(pts[k][1]), pts[k][2].toInt(), label))
            }
            val dr = Rng(hash(host) xor 77)
            groups.add(Group(host, constellationName(host), stars, FloatArray(stars.size) { 0.3f + dr.next() * 0.4f }))
        }
    }

    /** A made-up constellation: a wandering line of stars with the odd branch, never too close together. */
    private fun shape(host: String, n: Int): Array<FloatArray> {
        val r = Rng(hash(host))
        val pts = ArrayList<FloatArray>() // x, y (dp), parent
        val ang = ArrayList<Float>()
        for (k in 0 until n) {
            if (k == 0) { pts.add(floatArrayOf(0f, 0f, -1f)); ang.add(r.next() * 6.283f); continue }
            var ok: FloatArray? = null; var okA = 0f
            var tries = 0
            while (tries < 24 && ok == null) {
                val parent = if (k >= 3 && r.next() < 0.3f) (r.next() * k).toInt().coerceAtMost(k - 1) else k - 1
                val a = ang[parent] + (r.next() - 0.5f) * 1.7f
                val l = 58f + r.next() * 34f
                val x = pts[parent][0] + cos(a) * l; val y = pts[parent][1] + sin(a) * l
                val lim = 95f + tries * 6f
                if (hypot(x, y) <= lim && pts.all { hypot(it[0] - x, it[1] - y) >= 48f }) { ok = floatArrayOf(x, y, parent.toFloat()); okA = a }
                tries++
            }
            if (ok == null) { val a = r.next() * 6.283f; ok = floatArrayOf(pts[k - 1][0] + cos(a) * 60f, pts[k - 1][1] + sin(a) * 60f, (k - 1).toFloat()); okA = a }
            pts.add(ok); ang.add(okA)
        }
        return pts.toTypedArray()
    }

    // ------------------------------------------------------------------ the view
    private fun bounds(): FloatArray {
        val m = px(70f)
        var minX = -m; var maxX = worldW * zoom - width + m
        var minY = -m; var maxY = worldH * zoom - height + m
        if (maxX < minX) { val c = (worldW * zoom - width) / 2f; minX = c; maxX = c }
        if (maxY < minY) { val c = (worldH * zoom - height) / 2f; minY = c; maxY = c }
        return floatArrayOf(minX, maxX, minY, maxY)
    }

    private fun moveTo(x: Float, y: Float) {
        val (minX, maxX, minY, maxY) = bounds()
        vx = x.coerceIn(minX, maxX); vy = y.coerceIn(minY, maxY)
        onMove(vx, vy)
        invalidate()
    }

    private fun screenOf(s: StarPt) = Pair(s.x * zoom - vx, s.y * zoom - vy)

    private fun glideTo(s: StarPt) {
        glide?.cancel(); scroller.forceFinished(true)
        val fx = vx; val fy = vy
        val tx = s.x * zoom - width / 2f; val ty = s.y * zoom - height * 0.45f
        glide = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 520; interpolator = DecelerateInterpolator(1.6f)
            addUpdateListener { val t = it.animatedValue as Float; moveTo(fx + (tx - fx) * t, fy + (ty - fy) * t) }
            start()
        }
    }

    private fun place() {
        placed = true
        val c = current()
        if (c != null) moveTo(c.x * zoom - width / 2f, c.y * zoom - height * 0.45f) else moveTo((worldW - width) / 2f, (worldH - height) / 2f)
    }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) { if (!placed && items.isNotEmpty()) place() else moveTo(vx, vy) }

    override fun computeScroll() {
        if (scroller.computeScrollOffset()) { moveTo(scroller.currX.toFloat(), scroller.currY.toFloat()); postInvalidateOnAnimation() }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        // grab a window: drag it anywhere (it stays open there, linked to its star); just tap it to open the tab
        if (e.actionMasked == MotionEvent.ACTION_DOWN) {
            val w = windowAt(e.x, e.y)
            if (w != null) {
                dragWin = w; dragX0 = e.x; dragY0 = e.y; dragMoved = false
                dragOff0 = (pinned[pinKey(w.item)] ?: floatArrayOf(0f, 0f)).copyOf()
                scroller.forceFinished(true); glide?.cancel()
                return true
            }
        }
        dragWin?.let { w ->
            val key = pinKey(w.item)
            when (e.actionMasked) {
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.x - dragX0; val dy = e.y - dragY0
                    if (!dragMoved && hypot(dx, dy) > touchSlop) { dragMoved = true; parent.requestDisallowInterceptTouchEvent(true) }
                    if (dragMoved) { pinned[key] = floatArrayOf(dragOff0[0] + dx, dragOff0[1] + dy); invalidate() }
                }
                MotionEvent.ACTION_UP -> {
                    if (!dragMoved) onOpen(w.item.index)
                    else {
                        // dropped back on its star (or where it started from): it goes back to normal
                        val o = pinned[key] ?: floatArrayOf(0f, 0f)
                        val (sx, sy) = screenOf(w)
                        val onStar = winRect[w.item.index]?.contains(sx, sy) == true
                        if (hypot(o[0], o[1]) < px(40f) || onStar) {
                            ValueAnimator.ofFloat(1f, 0f).apply {
                                duration = 200; interpolator = DecelerateInterpolator()
                                addUpdateListener { v -> val f = v.animatedValue as Float; pinned[key] = floatArrayOf(o[0] * f, o[1] * f); invalidate() }
                                addListener(object : android.animation.AnimatorListenerAdapter() { override fun onAnimationEnd(a: android.animation.Animator) { pinned.remove(key); invalidate() } })
                                start()
                            }
                        } else performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK)
                    }
                    dragWin = null
                }
                MotionEvent.ACTION_CANCEL -> dragWin = null
            }
            return true
        }
        pinch.onTouchEvent(e)
        if (!pinch.isInProgress) gestures.onTouchEvent(e)
        return true
    }

    private fun starAt(x: Float, y: Float): StarPt? {
        var best: StarPt? = null; var bd = px(30f)
        groups.forEach { g -> g.stars.forEach { s -> val (sx, sy) = screenOf(s); val dd = hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = s } } }
        return best
    }

    /** where the arrow for a new star off the screen sits (or null if it's on the screen) */
    private fun arrowFor(s: StarPt): FloatArray? {
        val (sx, sy) = screenOf(s)
        val inset = px(26f)
        if (sx in inset..(width - inset) && sy in inset..(height - inset)) return null
        val cx = width / 2f; val cy = height / 2f
        val a = atan2(sy - cy, sx - cx)
        val ax = (cx + cos(a) * width).coerceIn(inset, width - inset)
        val ay = (cy + sin(a) * height).coerceIn(inset, height - inset)
        return floatArrayOf(ax, ay, a)
    }

    private fun arrowHit(x: Float, y: Float): StarPt? = groups.flatMap { it.stars }.filter { it.item.fresh }.firstOrNull { s ->
        val a = arrowFor(s); a != null && hypot(a[0] - x, a[1] - y) < px(30f)
    }

    // ------------------------------------------------------------------ drawing
    override fun onDraw(c: Canvas) {
        val now = SystemClock.uptimeMillis()
        val appear = ((now - born - SpaceSky.WARP * 0.55f) / 380f).coerceIn(0f, 1f)
        if (appear <= 0f) { postInvalidateOnAnimation(); return }
        var busy = appear < 1f || fading >= 0
        val pulse = 0.6f + 0.4f * sin(now / 260f)
        c.save()
        c.translate(-vx, -vy); c.scale(zoom, zoom)
        val dash = DashPathEffect(floatArrayOf(px(1.5f), px(4f)), 0f)
        line.pathEffect = dash
        val rx0 = vx / zoom - px(160f); val rx1 = (vx + width) / zoom + px(160f)
        val ry0 = vy / zoom - px(160f); val ry1 = (vy + height) / zoom + px(160f)
        for (g in groups) {
            val gx = g.stars.first().x; val gy = g.stars.first().y
            if (gx < rx0 - px(150f) || gx > rx1 + px(150f) || gy < ry0 - px(150f) || gy > ry1 + px(150f)) continue
            val gAlpha = appear * (if (query.isEmpty() || g.stars.any { isMatch(it) }) 1f else 0.25f)
            // dotted lines and a little star dust along them
            g.stars.forEachIndexed { k, s ->
                if (s.parent < 0) return@forEachIndexed
                val p = g.stars[s.parent]
                val a = gAlpha * starAlpha(s, now) * starAlpha(p, now)
                line.alpha = (140 * a).toInt(); c.drawLine(p.x, p.y, s.x, s.y, line)
                val t = g.bits[k]
                dust.alpha = (180 * a).toInt(); c.drawCircle(p.x + (s.x - p.x) * t, p.y + (s.y - p.y) * t, px(0.9f), dust)
            }
            // the stars
            for (s in g.stars) {
                val a = gAlpha * starAlpha(s, now) * (if (isMatch(s)) 1f else 0.3f)
                if (a <= 0.01f) continue
                val size = px(if (s.item.current) 3.4f else 2.4f) * (if (s.item.index == fading) 1f - fadeT else 1f)
                glow.shader = if (s.item.current) glowWarm else glowCool
                c.save(); c.translate(s.x, s.y); c.scale(size * 4f, size * 4f); glow.alpha = (255 * a).toInt(); c.drawCircle(0f, 0f, 1f, glow); c.restore()
                c.save(); c.translate(s.x, s.y); c.scale(size * 2.6f, size * 2.6f); core.alpha = (255 * a).toInt(); c.drawPath(sparkle, core); c.restore()
                if (s.item.current) { ring.color = MainActivity.CREAM; ring.alpha = (255 * a * (1f - (winA[s.item.index] ?: 0f))).toInt(); c.drawCircle(s.x, s.y, px(15f), ring) }
                if (s.item.fresh) { ring.color = 0xFFD66042.toInt(); ring.alpha = (230 * a * pulse).toInt(); c.drawCircle(s.x, s.y, px(15f), ring); busy = true }
                tStar.color = if (s.item.current) 0xFFFFF8EC.toInt() else 0x9EECE8E1.toInt()
                tStar.alpha = (tStar.alpha * a).toInt()
                c.drawText(s.label, s.x, s.y + px(28f), tStar)
            }
            // the constellation's name, above its highest star
            val top = g.stars.minOf { it.y }; val mid = g.stars.sumOf { it.x.toDouble() }.toFloat() / g.stars.size
            var nameY = top - px(24f)
            // a star's window is open: the name moves up above it instead of hiding under it
            g.stars.filter { (winA[it.item.index] ?: 0f) > 0f }.forEach { s ->
                val winTop = s.y - (px(34f) + px(112f) * zoom.coerceIn(0.9f, 1.3f) + px(10f)) / zoom
                if (abs(s.x - mid) < px(150f) && winTop < nameY) nameY = winTop
            }
            tName.alpha = (230 * gAlpha).toInt()
            c.drawText(g.name, mid, nameY, tName)
        }
        c.restore()

        // a small window above the star nearest the middle (and above every star when you zoom in): what's inside it
        if (drawWindows(c, appear)) busy = true

        // new tabs flying in as shooting stars
        for ((idx, t0) in arrivals.toList()) {
            val s = star(idx)
            if (s == null) { arrivals.remove(idx); continue }
            val p = (now - t0) / 700f
            if (p < 0f) { busy = true; continue }
            if (p >= 1f) { arrivals.remove(idx); continue }
            busy = true
            val (sx, sy) = screenOf(s)
            val ang = -PI.toFloat() * 0.78f
            val run = px(260f) * (1f - p)
            val hx = sx + cos(ang) * run; val hy = sy + sin(ang) * run
            val len = px(110f) * (1f - p * 0.6f)
            trail.shader = android.graphics.LinearGradient(hx, hy, hx + cos(ang) * len, hy + sin(ang) * len, 0xF2FFF8EC.toInt(), 0x00FFF8EC, Shader.TileMode.CLAMP)
            trail.strokeWidth = px(1.6f)
            c.drawLine(hx, hy, hx + cos(ang) * len, hy + sin(ang) * len, trail)
            trail.shader = null
        }

        // arrows to new tabs that are somewhere off the screen: look around to find them
        for (g in groups) for (s in g.stars) {
            if (!s.item.fresh) continue
            val a = arrowFor(s) ?: continue
            busy = true
            c.save(); c.translate(a[0], a[1]); c.rotate((a[2] * 180 / PI).toFloat())
            arrow.alpha = (242 * appear).toInt()
            val tri = Path().apply { moveTo(px(10f), 0f); lineTo(-px(4f), -px(8f)); lineTo(-px(4f), px(8f)); close() }
            c.drawPath(tri, arrow)
            arrow.alpha = (242 * appear * pulse).toInt()
            c.drawCircle(-px(12f), 0f, px(3f), arrow)
            c.restore()
            tNew.alpha = (230 * appear).toInt()
            c.drawText("NEW", a[0] - cos(a[2]) * px(12f), a[1] - sin(a[2]) * px(12f) + px(20f), tNew)
        }

        if (busy) postInvalidateOnAnimation() else postInvalidateDelayed(80)
    }

    /** Returns true while a window is still easing in or out (or its scan line is moving). */
    private fun drawWindows(c: Canvas, appear: Float): Boolean {
        if (appear < 1f) return false
        var moving = false
        val now = SystemClock.uptimeMillis()
        val all = groups.flatMap { it.stars }
        // the focus: the star nearest the middle of the screen
        var focus: StarPt? = null; var fd = px(130f)
        val mx = width / 2f; val my = height * 0.5f
        for (s in all) { val (sx, sy) = screenOf(s); val dd = hypot(sx - mx, sy - my); if (dd < fd) { fd = dd; focus = s } }
        val zoomedIn = zoom >= 1.25f
        winRect.clear()
        val zf = zoom.coerceIn(0.9f, 1.3f)
        val ww = px(150f) * zf; val wh = px(112f) * zf; val cut = px(10f)
        for (s in all) {
            val (sx, sy) = screenOf(s)
            val pin = pinned[pinKey(s.item)]
            val ox = pin?.get(0) ?: 0f; val oy = pin?.get(1) ?: 0f
            val onScreen = (sx + ox) > -ww && (sx + ox) < width + ww && (sy + oy) > -wh && (sy + oy) < height + wh * 2
            val want = if (onScreen && isMatch(s) && s.item.index != fading && (s === focus || zoomedIn || pin != null)) 1f else 0f
            val cur = winA[s.item.index] ?: 0f
            val a = if (abs(want - cur) < 0.04f) want else cur + (want - cur) * 0.24f
            if (a != want) moving = true
            if (a <= 0.01f) { winA.remove(s.item.index); continue }
            winA[s.item.index] = a
            moving = true // the scan line moves
            // opening: it unfolds from a thin line and flickers, like a HUD coming on
            val unfold = (a * a * (3 - 2 * a)).coerceAtLeast(0.06f)
            val flick = if (a < 0.7f && ((now / 40) % 3 == 0L)) 0.45f else 1f
            val alpha = a * flick * starAlpha(s, now)
            val al = (255 * alpha).toInt()
            val cx = sx; val bottom = sy - px(34f)
            val r = android.graphics.RectF(cx - ww / 2f, bottom - wh, cx + ww / 2f, bottom)
            r.offset(ox, oy)
            val mid = r.centerY(); r.top = mid - (mid - r.top) * unfold; r.bottom = mid + (r.bottom - mid) * unfold
            winRect[s.item.index] = r

            // connector: down from the window to a small node, then across to the star; targeting ticks round the star
            winLine.strokeWidth = px(1f); winLine.color = 0x73E7DFD1; winLine.alpha = al * 0x73 / 255
            winFill.color = MainActivity.CREAM; winFill.alpha = al
            if (pin == null) {
                val nx = cx - px(30f) * zf
                c.drawLine(nx, r.bottom, nx, r.bottom + px(10f), winLine)
                c.drawLine(nx, r.bottom + px(10f), cx - px(6f), sy - px(6f), winLine)
                c.drawRect(nx - px(2f), r.bottom + px(8f), nx + px(2f), r.bottom + px(12f), winFill)
            } else {
                // moved somewhere: a line from the nearest edge of the window to its star
                val nx = sx.coerceIn(r.left, r.right); val ny = sy.coerceIn(r.top, r.bottom)
                val dl = hypot(sx - nx, sy - ny)
                if (dl > px(18f)) {
                    val ex = sx - (sx - nx) / dl * px(18f); val ey = sy - (sy - ny) / dl * px(18f)
                    c.drawLine(nx, ny, ex, ey, winLine)
                    c.drawRect(nx - px(2f), ny - px(2f), nx + px(2f), ny + px(2f), winFill)
                }
            }
            winLine.color = MainActivity.CREAM; winLine.alpha = al; winLine.strokeWidth = px(1.2f)
            val rr = px(16f); val tk = px(5f)
            for (dx in intArrayOf(-1, 1)) for (dy in intArrayOf(-1, 1)) {
                c.drawLine(sx + dx * rr, sy + dy * (rr - tk), sx + dx * rr, sy + dy * rr, winLine)
                c.drawLine(sx + dx * rr, sy + dy * rr, sx + dx * (rr - tk), sy + dy * rr, winLine)
            }

            // the body, with two corners cut off
            val body = Path().apply {
                moveTo(r.left + cut, r.top); lineTo(r.right, r.top); lineTo(r.right, r.bottom - cut)
                lineTo(r.right - cut, r.bottom); lineTo(r.left, r.bottom); lineTo(r.left, r.top + cut); close()
            }
            winFill.color = 0xEB06080A.toInt(); winFill.alpha = (235 * alpha).toInt(); c.drawPath(body, winFill)
            winLine.color = 0x61E7DFD1; winLine.alpha = al * 0x61 / 255; winLine.strokeWidth = px(1f); c.drawPath(body, winLine)
            // brackets on the other two corners
            winLine.color = MainActivity.CREAM; winLine.alpha = al; winLine.strokeWidth = px(1.6f)
            val o = px(3f); val bl = px(12f)
            c.drawLine(r.right - bl, r.top - o, r.right + o, r.top - o, winLine); c.drawLine(r.right + o, r.top - o, r.right + o, r.top + bl, winLine)
            c.drawLine(r.left - o, r.bottom - bl, r.left - o, r.bottom + o, winLine); c.drawLine(r.left - o, r.bottom + o, r.left + bl, r.bottom + o, winLine)
            if (unfold < 0.5f) continue

            // readout: TAB 03 // SITE, and a status light
            val (stText, stCol) = when {
                s.item.fresh -> Pair("NEW", 0xFFE0694A.toInt())
                s.item.live -> Pair("LIVE", CYAN)
                else -> Pair("ASLEEP", 0x80E7DFD1.toInt())
            }
            tHud.textAlign = Paint.Align.RIGHT; tHud.color = stCol; tHud.alpha = al * android.graphics.Color.alpha(stCol) / 255
            c.drawText(stText, r.right - px(8f), r.top + px(12f), tHud)
            val stW = tHud.measureText(stText)
            winFill.color = stCol; winFill.alpha = (al * (0.6f + 0.4f * sin(now / 300f))).toInt()
            c.drawCircle(r.right - px(8f) - stW - px(6f), r.top + px(9.5f), px(2.2f), winFill)
            tHud.textAlign = Paint.Align.LEFT; tHud.color = 0xD9E7DFD1.toInt(); tHud.alpha = al * 0xD9 / 255
            val head = "TAB " + String.format("%02d", s.item.index + 1) + " // " + s.item.host.uppercase()
            c.drawText(TextUtils.ellipsize(head, tHud, r.width() - px(30f) - stW, TextUtils.TruncateAt.END).toString(), r.left + px(12f), r.top + px(12f), tHud)
            winFill.color = 0x40E7DFD1; winFill.alpha = al * 0x40 / 255
            c.drawRect(r.left + px(6f), r.top + px(17f), r.right - px(6f), r.top + px(18f), winFill)

            // the picture, with scanlines and a scan line sweeping down
            val pic = android.graphics.RectF(r.left + px(6f), r.top + px(21f), r.right - px(6f), r.bottom - px(15f))
            if (pic.height() > px(8f)) {
                c.save(); c.clipRect(pic)
                val b = s.item.thumb
                if (b != null && !b.isRecycled) {
                    val sc = pic.width() / b.width
                    val srcH = min(b.height.toFloat(), pic.height() / sc)
                    winPic.alpha = al
                    c.drawBitmap(b, android.graphics.Rect(0, 0, b.width, srcH.toInt()), android.graphics.RectF(pic.left, pic.top, pic.right, pic.top + srcH * sc), winPic)
                } else {
                    winFill.color = 0xFF0A0B0C.toInt(); winFill.alpha = al; c.drawRect(pic, winFill)
                    val letter = s.item.host.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "音"
                    tWinBig.alpha = al * 0x40 / 255; c.drawText(letter, pic.centerX(), pic.centerY() + px(4f), tWinBig)
                    tWinHint.alpha = al * 0x80 / 255; c.drawText("NO SIGNAL · OPEN IT ONCE", pic.centerX(), pic.bottom - px(7f), tWinHint)
                }
                winFill.color = 0x0D7FE3FF; winFill.alpha = al * 0x0D / 255; c.drawRect(pic, winFill)
                winFill.color = 0x38000000; winFill.alpha = al * 0x38 / 255
                var yy = pic.top; while (yy < pic.bottom) { c.drawRect(pic.left, yy, pic.right, yy + px(1f), winFill); yy += px(3f) }
                val scanY = pic.top + pic.height() * ((now % 2600) / 2600f)
                scan.shader = android.graphics.LinearGradient(0f, scanY - px(14f), 0f, scanY, 0x007FE3FF, 0x387FE3FF, Shader.TileMode.CLAMP)
                scan.alpha = al; c.drawRect(pic.left, scanY - px(14f), pic.right, scanY, scan)
                winFill.color = 0x807FE3FF.toInt(); winFill.alpha = al / 2; c.drawRect(pic.left, scanY, pic.right, scanY + px(1f), winFill)
                c.restore()
            }
            // footer
            tHud.color = 0x99E7DFD1.toInt(); tHud.alpha = al * 0x99 / 255
            c.drawText(if (pin != null) "◆ PINNED  ▸ OPEN" else "▸ TAP TO OPEN", r.left + px(12f), r.bottom - px(5f), tHud)
            tHud.textAlign = Paint.Align.RIGHT; tHud.color = 0x59E7DFD1; tHud.alpha = al * 0x59 / 255
            c.drawText(String.format("%03d:%03d", (s.x / d).toInt() % 1000, (s.y / d).toInt() % 1000), r.right - px(14f), r.bottom - px(5f), tHud)
            tHud.textAlign = Paint.Align.LEFT
        }
        return moving
    }

    private fun windowAt(x: Float, y: Float): StarPt? {
        val hit = winRect.entries.filter { (winA[it.key] ?: 0f) > 0.5f && it.value.contains(x, y) }.map { it.key }
        return groups.flatMap { it.stars }.firstOrNull { it.item.index in hit }
    }

    /** a new star only shows once its shooting star has arrived */
    private fun starAlpha(s: StarPt, now: Long): Float {
        val t0 = arrivals[s.item.index] ?: return 1f
        return ((now - t0 - 560) / 200f).coerceIn(0f, 1f)
    }
}
