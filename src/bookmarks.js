'use strict';
/* Oto — bookmarks bar, folders, import from other browsers */

const isFolder = (b) => Array.isArray(b && b.children);
function allBookmarks(list = S.bookmarks || [], out = []) {
  for (const b of list) { if (isFolder(b)) allBookmarks(b.children, out); else out.push(b); }
  return out;
}
const findBookmark = (url) => allBookmarks().find((b) => b.url === url);
function withIds(list) {
  return (list || []).map((b) => (isFolder(b)
    ? { id: uid(), title: b.title || 'Folder', children: withIds(b.children) }
    : { id: uid(), title: b.title || prettyUrl(b.url), url: b.url, favicon: b.favicon || '' }));
}
function removeBookmark(id, list = S.bookmarks) {
  const i = list.findIndex((b) => b.id === id);
  if (i >= 0) { list.splice(i, 1); return true; }
  return list.some((b) => isFolder(b) && removeBookmark(id, b.children));
}
function findById(id, list = S.bookmarks) {
  for (const b of list) {
    if (b.id === id) return b;
    if (isFolder(b)) { const f = findById(id, b.children); if (f) return f; }
  }
  return null;
}

function toggleBookmark() {
  const t = activeTab();
  if (!t) return;
  const ex = findBookmark(t.url);
  if (ex) {
    removeBookmark(ex.id);
    toast('Bookmark removed', { icon: 'star', timeout: 1400, action: { label: 'Undo', run: () => { S.bookmarks.push(ex); save(); renderBookmarks(); updateStar(); } } });
  } else {
    S.bookmarks.push({ id: uid(), url: t.url, title: t.title || prettyUrl(t.url), favicon: t.favicon || '' });
    toast('Bookmarked', { icon: 'star', timeout: 1400 });
  }
  save(); renderBookmarks(); updateStar();
}
function updateStar() {
  const t = activeTab();
  const on = !!(t && findBookmark(t.url));
  const b = $('#btnStar');
  b.classList.toggle('on', on);
  b.title = on ? 'Remove bookmark' : 'Bookmark this page';
  b.disabled = !t;
}

function openBookmark(b, e) {
  if (e && (e.button === 1 || e.ctrlKey)) { newTab(b.url, { background: true }); return; }
  const cur = activeTab();
  if (cur && !cur.essential) { loadIn(cur, b.url); activate(cur.id); } else newTab(b.url);
}
function folderItems(f) {
  return [
    { header: f.title },
    ...f.children.map((c) => (isFolder(c)
      ? { label: `${c.title}  ›`, icon: 'sidebar', run: () => setTimeout(() => showMenu(menuAt.x, menuAt.y, folderItems(c)), 0) }
      : { label: c.title, fav: { url: c.url, title: c.title, favicon: c.favicon }, run: () => openBookmark(c) })),
    f.children.some((c) => !isFolder(c)) ? '-' : null,
    f.children.some((c) => !isFolder(c)) ? { label: 'Open all in new tabs', icon: 'tab', run: () => f.children.filter((c) => !isFolder(c)).forEach((c) => newTab(c.url, { background: true })) } : null,
  ];
}
const menuAt = { x: 0, y: 0 };
function bookmarkMenu(b, x, y) {
  showMenu(x, y, isFolder(b) ? [
    { label: 'Open all in new tabs', icon: 'tab', run: () => allBookmarks(b.children).forEach((c) => newTab(c.url, { background: true })) },
    '-',
    { label: 'Remove folder', icon: 'trash', danger: true, run: () => { removeBookmark(b.id); save(); renderBookmarks(); } },
  ] : [
    { label: 'Open', icon: 'globe', run: () => openBookmark(b) },
    { label: 'Open in new tab', icon: 'tab', run: () => newTab(b.url) },
    { label: 'Open in background', icon: 'tab', run: () => newTab(b.url, { background: true }) },
    { label: 'Copy link', icon: 'copy', run: () => { oto.copy(b.url); toast('Link copied', { icon: 'copy', timeout: 1200 }); } },
    '-',
    { label: 'Edit bookmarks…', icon: 'edit', run: () => openSettings('bookmarks') },
    { label: 'Remove', icon: 'trash', danger: true, run: () => { removeBookmark(b.id); save(); renderBookmarks(); updateStar(); } },
  ]);
}

function bmChip(b) {
  const el = h('button', {
    class: `bm${isFolder(b) ? ' folder' : ''}`, title: isFolder(b) ? b.title : `${b.title}\n${b.url}`,
    onclick: (e) => {
      if (!isFolder(b)) return openBookmark(b, e);
      const r = el.getBoundingClientRect();
      menuAt.x = r.left; menuAt.y = r.bottom + 4;
      showMenu(menuAt.x, menuAt.y, folderItems(b));
    },
    onauxclick: (e) => { if (e.button === 1 && !isFolder(b)) openBookmark(b, e); },
    oncontextmenu: (e) => { e.preventDefault(); bookmarkMenu(b, e.clientX, e.clientY); },
  },
  isFolder(b) ? iconEl('sidebar') : favEl({ url: b.url, title: b.title, favicon: b.favicon }, null, true),
  b.title ? h('span', { class: 't' }, b.title) : null);
  return el;
}

function renderBookmarks() {
  const bar = $('#bmbar');
  if (!bar || !S) return;
  if (!S.settings.showBookmarks) { bar.replaceChildren(); return; }
  const list = S.bookmarks || [];
  if (!list.length) {
    bar.replaceChildren(h('span', { class: 'bm-hint' }, 'Bookmark pages with ☆ — or import them in Settings → Bookmarks'));
    return;
  }
  const chips = list.map(bmChip);
  bar.replaceChildren(...chips);
  // Anything that doesn't fit goes into a » overflow menu, like Chrome / Zen.
  requestAnimationFrame(() => {
    const box = bar.getBoundingClientRect();
    const max = box.right - 34;
    const hidden = [];
    chips.forEach((c, i) => {
      if (hidden.length || c.getBoundingClientRect().right > max) { c.style.display = 'none'; hidden.push(list[i]); }
    });
    if (hidden.length) {
      const more = h('button', { class: 'bm more', title: 'More bookmarks', html: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 7 5 5-5 5M13 7l5 5-5 5"/></svg>' });
      more.onclick = () => { const r = more.getBoundingClientRect(); menuAt.x = r.left - 160; menuAt.y = r.bottom + 4; showMenu(menuAt.x, menuAt.y, folderItems({ title: 'More bookmarks', children: hidden })); };
      bar.append(more);
    }
  });
}
// Re-fit whenever the bar's width changes — window resizes, and also the sidebar growing or
// shrinking beside it (which pushes the top bar without resizing the window).
let bmResize;
let bmLastW = 0;
const bmObserver = new ResizeObserver((entries) => {
  const w = Math.round(entries[0].contentRect.width);
  if (Math.abs(w - bmLastW) < 2) return;
  bmLastW = w;
  clearTimeout(bmResize);
  bmResize = setTimeout(() => renderBookmarks(), 60);
});
requestAnimationFrame(() => { const b = document.getElementById('bmbar'); if (b) bmObserver.observe(b); });

// ---- import
function mergeImported(tree, sourceName) {
  const fresh = withIds(tree);
  if (!S.bookmarks.length) S.bookmarks = fresh;
  else S.bookmarks.push({ id: uid(), title: `From ${sourceName}`, children: fresh });
  save(); renderBookmarks(); updateStar();
  const n = allBookmarks(fresh).length;
  toast(`Imported ${n} bookmark${n === 1 ? '' : 's'} from ${sourceName}`, { icon: 'star' });
}
async function importFromBrowser(id, name) {
  const r = await oto.importBookmarks(id);
  if (!r || !r.ok) { toast(`Couldn’t import from ${name}${r && r.error ? ` — ${r.error}` : ''}`, { timeout: 3000 }); return; }
  if (!r.tree.length) { toast(`${name} has no bookmarks to import`, { timeout: 2000 }); return; }
  mergeImported(r.tree, name);
}
// Netscape bookmark HTML — what Firefox, Zen, Chrome, Edge, Opera and Safari all export.
function parseBookmarkHtml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const walk = (dl) => {
    const out = [];
    if (!dl) return out;
    for (const dt of dl.querySelectorAll(':scope > dt, :scope > p > dt')) {
      const a = dt.querySelector(':scope > a');
      const h3 = dt.querySelector(':scope > h3');
      if (a && /^https?:/i.test(a.getAttribute('href') || '')) out.push({ title: a.textContent.trim(), url: a.getAttribute('href') });
      else if (h3) {
        let sub = dt.querySelector(':scope > dl');
        if (!sub) { let n = dt.nextElementSibling; while (n && n.tagName !== 'DL' && n.tagName !== 'DT') n = n.nextElementSibling; if (n && n.tagName === 'DL') sub = n; }
        out.push({ title: h3.textContent.trim(), children: walk(sub) });
      }
    }
    return out;
  };
  const top = walk(doc.querySelector('dl'));
  // Firefox puts the toolbar inside a "Bookmarks Toolbar" folder; lift it to the top.
  const tb = top.find((x) => x.children && /toolbar|bookmarks bar|favorites bar/i.test(x.title));
  return tb ? [...tb.children, ...top.filter((x) => x !== tb)] : top;
}
