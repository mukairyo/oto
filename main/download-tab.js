'use strict';
// A link that opens in a new tab and turns out to be a file (a target=_blank download link, a site's "Download"
// button that opens a new window) leaves a tab that never shows a page: just a white, empty tab. Chrome closes those
// tabs on its own and so does Oto. This is the check: the download came from a browser tab (a <webview>) that has
// never shown a page. A tab that already shows a page (a normal download link on a site) is never touched.
function isBlankTab(wc) {
  try {
    if (!wc || (wc.isDestroyed && wc.isDestroyed())) return false;
    if (typeof wc.getType === 'function' && wc.getType() !== 'webview') return false;
    const u = String(wc.getURL() || '');
    return u === '' || u === 'about:blank';
  } catch { return false; }
}

// Tells the window to close that tab once, at the right moment: right away, or when "ask where to save" is on, only
// after the Save dialog has been answered (so the dialog never loses the tab it belongs to).
function closer(wc, item, tell) {
  if (!isBlankTab(wc)) return () => {};
  const id = wc.id;
  let done = false;
  return (force) => {
    if (done) return;
    if (!force && item && typeof item.getSavePath === 'function' && !item.getSavePath()) return;
    done = true;
    try { tell(id); } catch {}
  };
}
module.exports = { isBlankTab, closer };
