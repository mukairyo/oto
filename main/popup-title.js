'use strict';
// A popup window's title bar always starts with where the window really is, worked out by Oto from its address, so a
// page can't pass itself off as another site's sign-in window. The page's own title only ever comes after it.
// (1.7.12) A page with no real address (about:blank, data:, an address that doesn't parse) never shows its title on
// its own any more: it's labelled as having no verified address, with the site that opened it when Oto knows it.
// Internationalised names show as the browser stores them (xn--…), so a look-alike name can't pass as the real one.
function hostOf(u) { return u.host || ''; }
function siteOf(url) {
  let u;
  try { u = new URL(String(url)); } catch { return 'Unknown address'; }
  if (u.protocol === 'https:') return hostOf(u) || 'Unknown address';
  if (u.protocol === 'http:') return `${hostOf(u)} (not secure)`;
  if (u.protocol === 'blob:') { try { return `${siteOf(u.pathname.replace(/\/[^/]*$/, ''))} (blob)`; } catch { return 'Unknown address'; } }
  if (u.protocol === 'about:') return 'Blank page (no address)';
  if (u.protocol === 'data:') return 'data: page (no address)';
  if (u.protocol === 'file:') return 'Local file';
  return `${u.protocol}${u.host ? `//${u.host}` : ''} (no verified address)`;
}
/** True when the address is a real site: https or http with a host. */
function hasSite(url) { try { const u = new URL(String(url)); return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.host; } catch { return false; } }
function popupTitle(url, title, opener) {
  let site = siteOf(url);
  if (!hasSite(url) && opener && hasSite(opener)) site += ` · opened by ${siteOf(opener)}`;
  const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return t && t !== site ? `${site} — ${t}` : site;
}
module.exports = { popupTitle, siteOf, hasSite };
