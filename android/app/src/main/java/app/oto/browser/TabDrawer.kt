package app.oto.browser

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max

/** One tab in the tab window. */
class DrawerItem(
    val index: Int,
    val title: String,
    val host: String,
    var thumb: Bitmap?,
    val current: Boolean,
    /** opened behind and not looked at yet: a red ring, and an arrow points to it until you've found it */
    val fresh: Boolean,
    /** arrived since the window was last open: it flies in as a shooting star */
    val drop: Boolean,
)

/**
 * The tab window, like the space overview window on Oto for Windows: a search box on top and every open tab below,
 * here as a star map in the same space as the Oto website (see [StarMap] and [SpaceSky]). Opening it comes out of warp.
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
    private fun pxi(v: Int) = (v * d).toInt()

    private val sky = SpaceSky(ctx)
    private val count: TextView
    private val search: EditText
    private val mapBox: FrameLayout
    private val map: StarMap
    private var card: View? = null

    init {
        orientation = LinearLayout.VERTICAL
        setWillNotDraw(false)
        isClickable = true
        setPadding(pxi(14), pxi(16), pxi(14), pxi(12))

        // "— 音 OTO // TABS ———— 05", like the sidebar labels on Windows
        val head = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(pxi(4), pxi(2), pxi(4), pxi(12)) }
        head.addView(mono("—  音  OTO // TABS", 10f, MainActivity.FG2, 0.24f))
        head.addView(View(ctx).apply { setBackgroundColor(MainActivity.LINE2) }, LinearLayout.LayoutParams(0, max(1, d.toInt()), 1f).apply { setMargins(pxi(10), 0, pxi(10), 0) })
        count = mono("", 10f, MainActivity.FG2, 0.2f)
        head.addView(count)
        addView(head)

        map = StarMap(ctx,
            onOpen = { i -> dismissCard(); onOpen(i) },
            onHold = { item, x, y -> showCard(item, x, y) },
            onMove = { x, y -> sky.offX = x * 0.15f; sky.offY = y * 0.15f; invalidate() })

        // find a tab, like "Find a tab in any space…" on Windows: the sky flies to it
        search = EditText(ctx).apply {
            hint = "Find a tab…"; textSize = 14f; setTextColor(MainActivity.FG); setHintTextColor(MainActivity.FG3)
            isSingleLine = true; imeOptions = EditorInfo.IME_ACTION_GO
            inputType = EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setPadding(pxi(14), 0, pxi(14), 0)
            background = box(0xB3030304.toInt(), MainActivity.LINE2, 6)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) { map.search(s?.toString() ?: "") }
            })
            setOnEditorActionListener { _, _, _ -> map.firstMatch()?.let { onOpen(it.index) }; true }
        }
        addView(search, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(42)))

        mapBox = FrameLayout(ctx).apply { clipChildren = true }
        mapBox.addView(map, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        // back to the tab you're on
        mapBox.addView(TextView(ctx).apply {
            text = "◎"; textSize = 18f; setTextColor(MainActivity.CREAM); gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0xB3030304.toInt()); setStroke(max(1, d.toInt()), MainActivity.LINE2) }
            contentDescription = "Back to the tab you're on"
            setOnClickListener { dismissCard(); map.home() }
        }, FrameLayout.LayoutParams(pxi(40), pxi(40), Gravity.BOTTOM or Gravity.END).apply { setMargins(0, 0, pxi(4), pxi(8)) })
        addView(mapBox, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply { setMargins(0, pxi(6), 0, 0) })

        addView(mono("DRAG TO PEEK INSIDE  ·  HOLD TO CLOSE", 8.5f, MainActivity.FG3, 0.14f).apply { gravity = Gravity.CENTER; setPadding(0, pxi(6), 0, pxi(10)) },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val btns = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        btns.addView(button("Close", false) { onDismiss() }, LinearLayout.LayoutParams(0, pxi(40), 1f).apply { setMargins(0, 0, pxi(6), 0) })
        btns.addView(button("+ New tab", true) { dismissCard(); onNew() }, LinearLayout.LayoutParams(0, pxi(40), 1f))
        addView(btns)
    }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) { super.onSizeChanged(w, h, ow, oh); sky.size(w, h) }

    override fun onDraw(c: Canvas) {
        val next = sky.draw(c)
        super.onDraw(c)
        if (next <= 0L) postInvalidateOnAnimation() else postInvalidateDelayed(next)
    }

    override fun onDetachedFromWindow() { super.onDetachedFromWindow(); sky.release() }

    /** Show these tabs. [removed]: the tab that was just closed. */
    fun show(items: List<DrawerItem>, removed: Int = -1) {
        count.text = String.format("%02d", items.size)
        map.show(items, removed)
    }

    /** A fresh picture of a tab's page arrived (shown when you hold its star). */
    fun setThumb(index: Int, b: Bitmap) = map.setThumb(index, b)

    fun hideKeyboard() {
        (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(search.windowToken, 0)
    }

    // ------------------------------------------------------------------ hold a star: a small card with the page
    private fun showCard(item: DrawerItem, x: Float, y: Float) {
        dismissCard()
        val holder = FrameLayout(context).apply { setOnClickListener { dismissCard() } } // tap anywhere else to put it away
        val cw = pxi(232)
        val panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL; isClickable = true
            setPadding(pxi(10), pxi(10), pxi(10), pxi(10))
            background = box(0xF0101012.toInt(), MainActivity.LINE2, 8)
        }
        item.thumb?.takeIf { !it.isRecycled }?.let { b ->
            panel.addView(ImageView(context).apply {
                setImageBitmap(b); scaleType = ImageView.ScaleType.MATRIX
                imageMatrix = android.graphics.Matrix().apply { val s = (cw - pxi(20)).toFloat() / b.width; setScale(s, s) }
                clipToOutline = true; outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
                background = box(0xFF000000.toInt(), MainActivity.LINE, 4)
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(120)).apply { setMargins(0, 0, 0, pxi(8)) })
        }
        panel.addView(TextView(context).apply {
            text = item.title; textSize = 14f; setTextColor(MainActivity.FG); setTypeface(typeface, Typeface.BOLD)
            maxLines = 2; ellipsize = TextUtils.TruncateAt.END
        })
        panel.addView(mono(item.host, 9f, MainActivity.FG3, 0.12f).apply { isAllCaps = false; setPadding(0, pxi(2), 0, pxi(10)) })
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("Open", true) { dismissCard(); onOpen(item.index) }, LinearLayout.LayoutParams(0, pxi(34), 1f).apply { setMargins(0, 0, pxi(6), 0) })
        row.addView(button("Close tab", false) { dismissCard(); map.fadeOut(item.index) { onClose(item.index) } }, LinearLayout.LayoutParams(0, pxi(34), 1f))
        panel.addView(row)
        holder.addView(panel, FrameLayout.LayoutParams(cw, ViewGroup.LayoutParams.WRAP_CONTENT))
        mapBox.addView(holder, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        card = holder
        panel.post {
            // next to the star, kept on the screen
            panel.x = (x - cw / 2f).coerceIn(pxi(4).toFloat(), (mapBox.width - cw - pxi(4)).toFloat().coerceAtLeast(0f))
            val below = y + pxi(40)
            panel.y = if (below + panel.height < mapBox.height - pxi(4)) below else (y - pxi(40) - panel.height).coerceAtLeast(pxi(4).toFloat())
            panel.alpha = 0f; panel.scaleX = 0.94f; panel.scaleY = 0.94f
            panel.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(140).start()
        }
    }

    private fun dismissCard() { card?.let { mapBox.removeView(it) }; card = null }

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
}
