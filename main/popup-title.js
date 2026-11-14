'use strict';
// Oto — the title bar of a popup a website opened: always the real site first, then the page's own title.
// No Electron here, so it can be unit-tested.
function siteOf(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:') return u.host;
    if (u.protocol === 'http:') return `${u.host} (not secure)`;
    if (u.protocol === 'about:' && u.href === 'about:blank') return '';
    return `${u.protocol}${u.host ? `//${u.host}` : ''}`;
  } catch { return ''; }
}
function popupTitle(url, title) {
  const site = siteOf(url);
  const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!site) return t || 'Oto';
  return t && t !== site ? `${site} — ${t}` : site;
}
module.exports = { popupTitle, siteOf };
