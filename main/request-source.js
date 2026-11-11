'use strict';
// Which page is a request for?
//
// The filter lists need to know: most tracker rules only apply when the tracker is loaded by ANOTHER site
// ("third-party"), so a company's own website keeps working. The filter engine reads the asking page from the Referer
// header. A page can switch that header off (Referrer-Policy: no-referrer or same-origin, rel=noreferrer, or
// referrerPolicy on a single request). Without it every tracker looked like part of the site itself and none of those
// rules applied: on such a page Oto blocked 12 of 47 well-known session recorders instead of 39.
//
// Electron knows the frame that makes each request whatever the header says. So: the Referer when there is one (the
// browser writes it and a page can't point it at another site), otherwise the frame, otherwise the tab's page.
const web = (u) => typeof u === 'string' && /^https?:/i.test(u);

function requestSource(d, topUrl) {
  if (!d) return '';
  if (web(d.referrer)) return d.referrer;
  try {
    const f = d.frame;
    if (f) {
      // a frame's own document is asked for by the frame around it
      let from = d.resourceType === 'subFrame' ? f.parent : f;
      // frames with no address of their own (about:blank, srcdoc, data:, blob:) act for the page around them
      for (let i = 0; from && i < 20; i++, from = from.parent) { const u = from.url; if (web(u)) return u; }
    }
  } catch { /* the frame is already gone */ }
  try { const u = typeof topUrl === 'function' ? topUrl() : topUrl; if (web(u)) return u; } catch { /* no tab */ }
  return d.referrer || '';
}

// The request as the filter engine should see it: same request, with the asking page filled in when the header is missing.
function withSource(d, topUrl) {
  if (!d || web(d.referrer)) return d;
  const src = requestSource(d, topUrl);
  return src && src !== d.referrer ? Object.assign({}, d, { referrer: src }) : d;
}

module.exports = { requestSource, withSource };
