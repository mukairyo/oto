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
    /** its page is loaded right now (LIVE on its window); otherwise it's asleep until you open it */
    val live: Boolean = false,
    /** pinned: kept safe (the back button and × never close it) and marked with ◆ */
    val pinned: Boolean = false,
    /** the constellation you put it in yourself (null = its site's constellation) */
    val group: String? = null,
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
    /** pin or unpin a tab */
    private val onPin: (Int) -> Unit,
    /** put a tab in one of your constellations (null = back to its site's) */
    private val onGroup: (Int, String?) -> Unit,
    /** rename one of your constellations */
    private val onRename: (String, String) -> Unit,
) : LinearLayout(ctx) {

    private var items: List<DrawerItem> = emptyList()

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
        head.addView(mono("—  音  OTO // TABS", 11f, MainActivity.FG, 0.22f))
        head.addView(View(ctx).apply { setBackgroundColor(MainActivity.LINE2) }, LinearLayout.LayoutParams(0, max(1, d.toInt()), 1f).apply { setMargins(pxi(10), 0, pxi(10), 0) })
        count = mono("", 11f, MainActivity.FG, 0.2f)
        head.addView(count)
        addView(head)

        map = StarMap(ctx,
            onOpen = { i -> dismissCard(); onOpen(i) },
            onHold = { item, x, y -> showCard(item, x, y) },
            onCloseTab = { i -> dismissCard(); onClose(i) },
            onMove = { x, y -> sky.offX = x * 0.15f; sky.offY = y * 0.15f; invalidate() })

        // find a tab, like "Find a tab in any space…" on Windows: the sky flies to it
        search = EditText(ctx).apply {
            hint = "Find a tab…"; textSize = 15f; setTextColor(MainActivity.FG); setHintTextColor(MainActivity.FG2)
            isSingleLine = true; imeOptions = EditorInfo.IME_ACTION_GO
            inputType = EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setPadding(pxi(14), 0, pxi(14), 0)
            background = box(0xB3030304.toInt(), MainActivity.LINE2, 6)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) { map.search(s?.toString() ?: "") }
            })
            setOnEditorActionListener { _, _, _ -> map.firstMatch()?.let { hideKeyboard(); map.openWithZoom(it.index) }; true }
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

        addView(mono("TAP TO OPEN  ·  HOLD FOR MORE  ·  × CLOSES", 9.5f, MainActivity.FG2, 0.12f).apply { gravity = Gravity.CENTER; setPadding(0, pxi(6), 0, pxi(10)) },
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
        this.items = items
        count.text = String.format("%02d", items.size)
        map.show(items, removed)
    }

    /** Fly to a tab's star (after it moved to another constellation). */
    fun focus(index: Int) = map.focusTab(index)

    /** A new tab: its star is born, the view locks on and dives in, then [then] opens it. */
    fun birth(index: Int, then: () -> Unit) { dismissCard(); map.birth(index, then) }

    /** A fresh picture of a tab's page arrived (shown when you hold its star). */
    fun setThumb(index: Int, b: Bitmap) = map.setThumb(index, b)

    fun hideKeyboard() {
        (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(search.windowToken, 0)
    }

    // ------------------------------------------------------------------ hold a star: its menu
    // The page's picture, then OPEN · PIN, GROUP… · CLOSE. "Group…" puts the tab in one of your own
    // constellations (or a new one with a made-up name you can rename), or back with its site.
    private fun showCard(item: DrawerItem, x: Float, y: Float) {
        dismissCard()
        val holder = FrameLayout(context).apply { setOnClickListener { dismissCard() } } // tap anywhere else to put it away
        val cw = pxi(240)
        val panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL; isClickable = true
            setPadding(pxi(10), pxi(10), pxi(10), pxi(10))
            background = box(0xF2101012.toInt(), MainActivity.LINE2, 8)
        }
        var mainPage: () -> Unit = {}
        var groupPage: () -> Unit = {}
        var renamePage: (String) -> Unit = {}
        mainPage = {
            panel.removeAllViews()
            item.thumb?.takeIf { !it.isRecycled }?.let { b ->
                panel.addView(ImageView(context).apply {
                    setImageBitmap(b); scaleType = ImageView.ScaleType.MATRIX
                    imageMatrix = android.graphics.Matrix().apply { val s = (cw - pxi(20)).toFloat() / b.width; setScale(s, s) }
                    clipToOutline = true; outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
                    background = box(0xFF000000.toInt(), MainActivity.LINE, 4)
                }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(120)).apply { setMargins(0, 0, 0, pxi(8)) })
            }
            panel.addView(TextView(context).apply {
                text = (if (item.pinned) "◆ " else "") + item.title; textSize = 14.5f; setTextColor(MainActivity.FG); setTypeface(typeface, Typeface.BOLD)
                maxLines = 2; ellipsize = TextUtils.TruncateAt.END
            })
            panel.addView(mono(item.host + (item.group?.let { "  ·  $it" } ?: ""), 10f, MainActivity.FG2, 0.1f).apply { isAllCaps = false; setPadding(0, pxi(3), 0, pxi(10)) })
            fun row(vararg b: View) {
                val r = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
                b.forEachIndexed { i, v -> r.addView(v, LinearLayout.LayoutParams(0, pxi(36), 1f).apply { if (i < b.size - 1) setMargins(0, 0, pxi(6), 0) }) }
                panel.addView(r, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(0, 0, 0, pxi(6)) })
            }
            row(button("Open", true) { dismissCard(); map.openWithZoom(item.index) },
                button(if (item.pinned) "Unpin" else "◆ Pin", false) { dismissCard(); onPin(item.index) })
            row(button("Group…", false) { groupPage() },
                button("Close", false) { dismissCard(); map.fadeOut(item.index) { onClose(item.index) } })
        }
        groupPage = {
            panel.removeAllViews()
            panel.addView(mono("—  GROUP INTO", 10f, MainActivity.FG2, 0.18f).apply { setPadding(pxi(2), 0, 0, pxi(10)) })
            fun option(label: String, cream: Boolean = false, onClick: () -> Unit) {
                panel.addView(button(label, cream, onClick), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(36)).apply { setMargins(0, 0, 0, pxi(6)) })
            }
            val mine = items.mapNotNull { it.group }.distinct().sorted()
            mine.filter { it != item.group }.forEach { g -> option("→  $g") { dismissCard(); onGroup(item.index, g) } }
            option("+  New constellation", true) {
                dismissCard(); onGroup(item.index, StarMap.newConstellationName(items.mapNotNull { it.group }.toSet()))
            }
            item.group?.let { g ->
                option("Rename “$g”") { renamePage(g) }
                option("Back to ${StarMap.constellationName(item.host)}") { dismissCard(); onGroup(item.index, null) }
            }
            option("‹  Back") { mainPage() }
        }
        renamePage = { old ->
            panel.removeAllViews()
            panel.addView(mono("—  RENAME CONSTELLATION", 10f, MainActivity.FG2, 0.18f).apply { setPadding(pxi(2), 0, 0, pxi(10)) })
            val field = EditText(context).apply {
                setText(old); setSelection(old.length); textSize = 15f; setTextColor(MainActivity.FG); isSingleLine = true
                setPadding(pxi(12), 0, pxi(12), 0); background = box(0x14FFFFFF, MainActivity.LINE2, 6)
                filters = arrayOf(android.text.InputFilter.LengthFilter(24))
            }
            panel.addView(field, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, pxi(42)).apply { setMargins(0, 0, 0, pxi(8)) })
            val done = {
                val n = field.text.toString().trim()
                hideKeyboard(); dismissCard()
                if (n.isNotEmpty() && n != old) onRename(old, n)
            }
            field.imeOptions = EditorInfo.IME_ACTION_DONE
            field.setOnEditorActionListener { _, _, _ -> done(); true }
            val r = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
            r.addView(button("Cancel", false) { hideKeyboard(); groupPage() }, LinearLayout.LayoutParams(0, pxi(36), 1f).apply { setMargins(0, 0, pxi(6), 0) })
            r.addView(button("Save", true) { done() }, LinearLayout.LayoutParams(0, pxi(36), 1f))
            panel.addView(r)
            field.requestFocus()
            (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(field, InputMethodManager.SHOW_IMPLICIT)
        }
        mainPage()
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
        // keep it on the screen when it changes size (constellation list, rename)
        panel.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            if (v.y + v.height > mapBox.height - pxi(4)) v.y = (mapBox.height - pxi(4) - v.height).toFloat().coerceAtLeast(pxi(4).toFloat())
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
