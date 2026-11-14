package app.oto.browser

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextPaint
import android.text.TextUtils
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** One folder in the tab window. */
class DrawerItem(
    val index: Int,
    val title: String,
    val host: String,
    var thumb: Bitmap?,
    val current: Boolean,
    /** opened behind and not looked at yet: a small "new" mark on its label */
    val fresh: Boolean,
    /** arrived since the window was last open: it drops into the drawer */
    val drop: Boolean,
)

/**
 * The tab window, like the space overview window on Oto for Windows: a search box on top and every open tab below.
 * The tabs stand in a drawer like hanging file folders, each with the page's name on its label; the ones further back
 * are a little smaller and darker, and new tabs drop in at their place. Tap a folder to open it, swipe it sideways
 * (or tap ×) to close it.
 */
@SuppressLint("ViewConstructor")
class TabDrawer(
    ctx: Context,
    private val onOpen: (Int) -> Unit,
    private val onClose: (Int) -> Unit,
    private val onNew: () -> Unit,
    private val onDismiss: () -> Unit,
) : LinearLayout(ctx) {

    private val d = resources.displayMetrics.density
    private fun px(v: Float) = v * d
    private fun pxi(v: Int) = (v * d).toInt()
    private fun sp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, v, resources.displayMetrics)

    // folder geometry (dp)
    private val folderH = px(232f)
    private val step = px(94f)       // how much of each folder behind shows
    private val labelH = px(24f)
    private val hookRoom = px(14f)
    private val flapTop = labelH + px(16f)
    private val padTop = px(18f)
    private val padBottom = px(28f)

    private var all: List<DrawerItem> = emptyList()
    private var query = ""
    private var first = true
    private val folders = ArrayList<Folder>()

    private val count: TextView
    private val search: EditText
    private val scroll: ScrollView
    private val stack: Stack

    init {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(MainActivity.BG)
        isClickable = true
        setPadding(pxi(14), pxi(16), pxi(14), pxi(12))

        // "— 音 OTO // TABS ———— 05", like the sidebar labels on Windows
        val head = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(pxi(4), pxi(2), pxi(4), pxi(12)) }
        head.addView(mono("—  音  OTO // TABS", 10f, MainActivity.FG2, 0.24f))
        head.addView(View(ctx).apply { setBackgroundColor(MainActivity.LINE2) }, LinearLayout.LayoutParams(0, max(1, d.toInt()), 1f).apply { setMargins(pxi(10), 0, pxi(10), 0) })
        count = mono("", 10f, MainActivity.FG2, 0.2f)
        head.addView(count)
        addView(head)

        // find a tab, like "Find a tab in any space…" on Windows
        search = EditText(ctx).apply {
            hint = "Find a tab…"; textSize = 14f; setTextColor(MainActivity.FG); setHintTextColor(MainActivity.FG3)
            isSingleLine = true; imeOptions = EditorInfo.IME_ACTION_GO
            inputType = EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setPadding(pxi(14), 0, pxi(14), 0)
            background = box(0x08FFFFFF, MainActivity.LINE2, 6)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) { query = s?.toString()?.trim() ?: ""; paint(-1, false) }
            })
            setOnEditorActionListener { _, _, _ -> folders.firstOrNull()?.let { onOpen(it.item.index) }; true }
        }
        addView(search, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(42)))

        stack = Stack(ctx)
        scroll = ScrollView(ctx).apply { isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER; isFillViewport = true; addView(stack) }
        addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply { setMargins(0, pxi(6), 0, 0) })

        addView(mono("TAP TO OPEN  ·  SWIPE SIDEWAYS TO CLOSE", 9f, MainActivity.FG3, 0.18f).apply { gravity = Gravity.CENTER; setPadding(0, pxi(4), 0, pxi(10)) },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val btns = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        btns.addView(button("Close", false) { onDismiss() }, LinearLayout.LayoutParams(0, pxi(40), 1f).apply { setMargins(0, 0, pxi(6), 0) })
        btns.addView(button("+ New tab", true) { onNew() }, LinearLayout.LayoutParams(0, pxi(40), 1f))
        addView(btns)
    }

    /** Show these tabs. [removed]: the place a folder was just taken out of (the ones in front of it slide back). */
    fun show(items: List<DrawerItem>, removed: Int = -1) {
        all = items
        count.text = String.format("%02d", items.size)
        paint(removed, first)
        if (first) {
            first = false
            // open on the tab you're on
            val ci = folders.indexOfFirst { it.item.current }
            if (ci >= 0) scroll.post {
                val top = padTop + ci * step
                scroll.scrollTo(0, max(0, (top - scroll.height * 0.45f).toInt()))
            }
        }
    }

    /** A fresh picture of a tab's page arrived. */
    fun setThumb(index: Int, b: Bitmap) {
        all.firstOrNull { it.index == index }?.thumb = b
        folders.firstOrNull { it.item.index == index }?.invalidate()
    }

    fun hideKeyboard() {
        (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(search.windowToken, 0)
    }

    private fun shown(): List<DrawerItem> {
        if (query.isEmpty()) return all
        val words = query.lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return all.filter { i -> val s = (i.title + " " + i.host).lowercase(); words.all { s.contains(it) } }
    }

    private fun paint(removed: Int, entering: Boolean) {
        stack.removeAllViews(); folders.clear()
        val list = shown()
        val n = list.size
        list.forEachIndexed { pos, item ->
            val depth = n - 1 - pos
            val f = Folder(item, pos)
            val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, folderH.toInt()).apply { topMargin = (padTop + pos * step).toInt() }
            stack.addView(f, lp)
            folders.add(f)
            val s = max(0.84f, 1f - 0.022f * depth)
            f.scaleX = s; f.scaleY = s
            f.dim = min(0.42f, 0.055f * depth)
            when {
                item.drop -> {
                    // a new tab drops into its place in the drawer
                    f.translationY = -step * 1.4f; f.alpha = 0f
                    f.animate().translationY(0f).alpha(1f).setStartDelay(if (entering) 260L else 60L).setDuration(460).setInterpolator(OvershootInterpolator(1.3f)).start()
                }
                entering -> {
                    f.translationY = px(26f) + depth.coerceAtMost(6) * px(3f); f.alpha = 0f
                    f.animate().translationY(0f).alpha(1f).setStartDelay(min(pos, 10) * 16L).setDuration(240).setInterpolator(DecelerateInterpolator()).start()
                }
                removed >= 0 && item.index >= removed -> {
                    f.translationY = step
                    f.animate().translationY(0f).setDuration(220).setInterpolator(DecelerateInterpolator()).start()
                }
            }
        }
        if (n == 0) stack.addView(mono(if (query.isEmpty()) "NO TABS" else "NO TAB MATCHES", 10f, MainActivity.FG3, 0.2f).apply { gravity = Gravity.CENTER },
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(120)))
        stack.requestLayout(); stack.invalidate()
    }

    // ------------------------------------------------------------------ the drawer (rails the folders hang on)
    private inner class Stack(ctx: Context) : FrameLayout(ctx) {
        private val rail = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2B2B2F.toInt(); style = Paint.Style.STROKE; strokeWidth = px(3f); strokeCap = Paint.Cap.ROUND }
        private val shine = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x1FFFFFFF; style = Paint.Style.STROKE; strokeWidth = px(1f) }
        private val floor = Paint().apply { color = 0xFF0F0F11.toInt() }
        init { setWillNotDraw(false); clipChildren = false; setPadding(0, 0, 0, padBottom.toInt()) }

        override fun onDraw(c: Canvas) {
            if (folders.isEmpty()) return
            // the inside of the drawer
            c.drawRoundRect(RectF(px(6f), 0f, width - px(6f), height.toFloat()), px(8f), px(8f), floor)
            // two rails that run back into the drawer, through each folder's hooks
            val l = Path(); val r = Path()
            folders.forEachIndexed { i, f ->
                val s = f.scaleY; val w = f.width.toFloat()
                val y = f.top + (labelH + px(6f)) * s
                val xl = w / 2f - (w / 2f - px(9f)) * s
                val xr = w / 2f + (w / 2f - px(9f)) * s
                if (i == 0) { l.moveTo(xl, 0f); r.moveTo(xr, 0f) }
                l.lineTo(xl, y); r.lineTo(xr, y)
                if (i == folders.size - 1) { l.lineTo(xl, height.toFloat()); r.lineTo(xr, height.toFloat()) }
            }
            c.drawPath(l, rail); c.drawPath(r, rail)
            c.save(); c.translate(-px(1f), -px(1f)); c.drawPath(l, shine); c.drawPath(r, shine); c.restore()
        }
    }

    // ------------------------------------------------------------------ one hanging file folder
    private inner class Folder(val item: DrawerItem, val pos: Int) : View(context) {
        var dim = 0f
        private val base = PALETTE[((item.host.hashCode() % PALETTE.size) + PALETTE.size) % PALETTE.size]
        private val dark = luminance(base) < 0.55f
        private val ink = if (dark) MainActivity.FG else MainActivity.INK
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = px(1.5f) }
        private val tLabel = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(8.5f); letterSpacing = 0.12f; color = MainActivity.INK }
        private val tNum = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(10f); letterSpacing = 0.1f; color = ink; alpha = 150 }
        private val tTitle = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textSize = sp(16f); color = ink }
        private val tHost = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = sp(10f); letterSpacing = 0.08f; color = ink; alpha = 175 }
        private val tBig = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL); textSize = sp(64f); color = ink; alpha = 46; textAlign = Paint.Align.CENTER }
        private val tX = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = sp(20f); color = ink; alpha = 190; textAlign = Paint.Align.CENTER }
        private val label = RectF()
        private val closeBox = RectF()
        private val slop = ViewConfiguration.get(context).scaledTouchSlop
        private var downX = 0f; private var downY = 0f; private var dragging = false; private var gone = false

                override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
            pivotX = w / 2f; pivotY = 0f
            // the labels sit at different places along the top, like real hanging files
            val lw = (w - hookRoom * 2) * 0.36f
            val slots = floatArrayOf(0.06f, 0.33f, 0.60f)
            val lx = hookRoom + (w - hookRoom * 2) * slots[pos % 3]
            label.set(lx, 0f, min(lx + lw, w - hookRoom - px(4f)), labelH + px(6f))
            closeBox.set(w - hookRoom - px(46f), flapTop, w - hookRoom, flapTop + px(42f))
        }

        override fun onDraw(c: Canvas) {
            val w = width.toFloat(); val h = height.toFloat()
            val left = hookRoom; val right = w - hookRoom
            // hooks resting on the rails
            fill.color = 0xFF1A1A1C.toInt()
            c.drawRoundRect(px(2f), labelH + px(2f), left + px(10f), labelH + px(10f), px(2f), px(2f), fill)
            c.drawRoundRect(right - px(10f), labelH + px(2f), w - px(2f), labelH + px(10f), px(2f), px(2f), fill)
            // back flap
            fill.color = shade(base, 0.78f)
            c.drawRoundRect(left, labelH, right, h, px(5f), px(5f), fill)
            // the label (clear plastic tab with a paper insert)
            fill.color = 0xFF2A2A2C.toInt()
            c.drawRoundRect(label.left - px(2f), label.top, label.right + px(2f), label.bottom + px(4f), px(3f), px(3f), fill)
            fill.color = if (item.current) MainActivity.CREAM else 0xFFF3F0E9.toInt()
            c.drawRoundRect(label.left, label.top + px(2f), label.right, label.bottom, px(2f), px(2f), fill)
            var tx = label.left + px(7f)
            if (item.fresh) { fill.color = 0xFFC4553B.toInt(); c.drawCircle(tx + px(3f), (label.top + label.bottom) / 2f + px(1f), px(3f), fill); tx += px(10f) }
            val lt = TextUtils.ellipsize(item.title.uppercase(), tLabel, label.right - tx - px(6f), TextUtils.TruncateAt.END).toString()
            c.drawText(lt, tx, (label.top + label.bottom) / 2f + tLabel.textSize * 0.38f + px(1f), tLabel)
            // the pages inside
            fill.color = 0xFFE9E2D3.toInt()
            c.drawRect(left + px(10f), labelH + px(7f), right - px(14f), h, fill)
            fill.color = 0xFFD3C6AA.toInt()
            c.drawRect(left + px(22f), labelH + px(11f), right - px(30f), h, fill)
            // front flap
            fill.color = base
            c.drawRoundRect(left, flapTop, right, h, px(4f), px(4f), fill)
            fill.color = if (dark) 0x26FFFFFF else 0x40FFFFFF
            c.drawRect(left + px(3f), flapTop, right - px(3f), flapTop + px(1f), fill)
            // number, name, site
            val tx2 = left + px(14f)
            // (kept in the top strip, so the label of the folder in front never covers them)
            val num = String.format("%02d", item.index + 1)
            c.drawText(num, tx2, flapTop + px(18f), tNum)
            c.drawText("×", closeBox.centerX(), closeBox.centerY() + tX.textSize * 0.32f, tX)
            val tw = right - tx2 - px(48f)
            val hx = tx2 + tNum.measureText(num) + px(10f)
            c.drawText(TextUtils.ellipsize(item.host, tHost, right - hx - px(48f), TextUtils.TruncateAt.END).toString(), hx, flapTop + px(18f), tHost)
            c.drawText(TextUtils.ellipsize(item.title, tTitle, tw, TextUtils.TruncateAt.END).toString(), tx2, flapTop + px(42f), tTitle)
            // a picture of the page (or the site's first letter until Oto has seen it)
            val pic = RectF(left + px(12f), flapTop + px(56f), right - px(12f), h - px(12f))
            if (pic.height() > px(20f)) {
                val b = item.thumb
                if (b != null && !b.isRecycled) {
                    c.save()
                    val clip = Path().apply { addRoundRect(pic, px(4f), px(4f), Path.Direction.CW) }
                    c.clipPath(clip)
                    val sc = pic.width() / b.width
                    val srcH = min(b.height.toFloat(), pic.height() / sc)
                    c.drawBitmap(b, Rect(0, 0, b.width, srcH.toInt()), RectF(pic.left, pic.top, pic.right, pic.top + srcH * sc), Paint(Paint.FILTER_BITMAP_FLAG))
                    c.restore()
                    stroke.color = 0x22000000; stroke.strokeWidth = px(1f)
                    c.drawRoundRect(pic, px(4f), px(4f), stroke)
                } else {
                    fill.color = if (dark) 0x14FFFFFF else 0x14000000
                    c.drawRoundRect(pic, px(4f), px(4f), fill)
                    val letter = item.host.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "音"
                    c.drawText(letter, pic.centerX(), pic.centerY() + tBig.textSize * 0.34f, tBig)
                }
            }
            // the tab you're on
            if (item.current) {
                stroke.color = MainActivity.CREAM; stroke.strokeWidth = px(1.5f)
                c.drawRoundRect(left + px(0.75f), flapTop + px(0.75f), right - px(0.75f), h - px(0.75f), px(4f), px(4f), stroke)
            }
            // further back in the drawer = darker
            if (dim > 0f) {
                fill.color = ((dim * 255).toInt() shl 24)
                c.drawRoundRect(left, labelH, right, h, px(5f), px(5f), fill)
                c.drawRoundRect(label.left - px(2f), label.top, label.right + px(2f), labelH, px(3f), px(3f), fill)
            }
        }

        private fun hit(x: Float, y: Float) = (y >= labelH && x >= hookRoom && x <= width - hookRoom) || label.contains(x, y)

        @SuppressLint("ClickableViewAccessibility")
        override fun onTouchEvent(e: MotionEvent): Boolean {
            if (gone) return false
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    // the empty space beside the label belongs to the folder behind
                    if (!hit(e.x, e.y)) return false
                    downX = e.rawX; downY = e.rawY; dragging = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX; val dy = e.rawY - downY
                    if (!dragging && abs(dx) > slop && abs(dx) > abs(dy) * 1.2f) { dragging = true; parent.requestDisallowInterceptTouchEvent(true) }
                    if (dragging) { translationX = dx; alpha = 1f - min(0.85f, abs(dx) / width) }
                }
                MotionEvent.ACTION_UP -> {
                    val dx = e.rawX - downX; val dy = e.rawY - downY
                    if (dragging) {
                        if (abs(translationX) > width * 0.28f) takeOut(if (translationX > 0) 1f else -1f) else settle()
                    } else if (abs(dx) < slop && abs(dy) < slop) {
                        if (closeBox.contains(e.x, e.y)) takeOut(1f) else pullUp()
                    }
                    dragging = false
                }
                MotionEvent.ACTION_CANCEL -> { if (dragging) settle(); dragging = false }
            }
            return true
        }

        private fun settle() = animate().translationX(0f).alpha(1f).setDuration(180).setInterpolator(DecelerateInterpolator()).start()

        private fun takeOut(dir: Float) {
            gone = true
            animate().translationX(dir * width).alpha(0f).setDuration(170).withEndAction { onClose(item.index) }.start()
        }

        private fun pullUp() {
            gone = true
            animate().translationY(-px(22f)).setDuration(130).setInterpolator(DecelerateInterpolator()).withEndAction { onOpen(item.index) }.start()
        }
    }

    // ------------------------------------------------------------------ helpers
    private fun mono(text: String, size: Float, color: Int, spacing: Float) = TextView(context).apply {
        this.text = text; textSize = size; setTextColor(color); typeface = Typeface.MONOSPACE; letterSpacing = spacing
        isAllCaps = true; maxLines = 1; ellipsize = TextUtils.TruncateAt.END
    }

    private fun box(bg: Int, stroke: Int, radius: Int) = GradientDrawable().apply {
        setColor(bg); cornerRadius = radius * d; setStroke(max(1, d.toInt()), stroke)
    }

    private fun button(text: String, cream: Boolean, onClick: () -> Unit) = mono(text, 10f, if (cream) MainActivity.INK else MainActivity.FG2, 0.18f).apply {
        gravity = Gravity.CENTER
        background = if (cream) box(MainActivity.CREAM, MainActivity.CREAM, 4) else box(0x00000000, MainActivity.LINE2, 4)
        setOnClickListener { onClick() }
    }

    companion object {
        /** folder colours: sage, manila, clay, slate, olive, sand, plum-brown (a site always gets the same one) */
        private val PALETTE = intArrayOf(
            0xFF6E7B66.toInt(), 0xFFCDB892.toInt(), 0xFF9C6A52.toInt(), 0xFF46524F.toInt(),
            0xFF59614A.toInt(), 0xFFB7A483.toInt(), 0xFF5B4B45.toInt(),
        )

        private fun luminance(c: Int): Float = (0.299f * ((c shr 16) and 255) + 0.587f * ((c shr 8) and 255) + 0.114f * (c and 255)) / 255f

        private fun shade(c: Int, f: Float): Int {
            val r = (((c shr 16) and 255) * f).toInt(); val g = (((c shr 8) and 255) * f).toInt(); val b = ((c and 255) * f).toInt()
            return (0xFF shl 24) or (r shl 16) or (g shl 8) or b
        }
    }
}
