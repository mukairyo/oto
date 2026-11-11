'use strict';
// Click identifiers in links.
//
// When you click an ad or a link in a newsletter or on a social network, the sender often adds a number that is unique
// to you or to that click (fbclid, gclid, msclkid, ...). The site you land on hands it back to the sender, which ties
// your visit there to your account with them. Oto removes these from the address before the page is asked for.
//
// Only parameters that exist for this purpose are removed (the same kind of list Firefox and Brave use). Left alone on
// purpose: campaign labels (utm_source and friends say which campaign, not who you are), affiliate parameters (the
// shop needs them to pay the site that sent you), and short everyday names a site may use for something of its own.
const CLICK_IDS = new Set([
  'fbclid', 'gclid', 'gclsrc', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'twclid', 'ttclid', 'yclid', 'ysclid', 'li_fat_id', 'epik', 'igshid', 'igsh',
  'mc_eid', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'hsctatracking', 'mkt_tok', 'vero_id', 'vero_conv', 'oly_anon_id', 'oly_enc_id',
  '_openstat', 'wickedid', 'rb_clickid', 'ml_subscriber', 'ml_subscriber_hash', '_kx', '__s',
]);

// The address without click identifiers, or '' when there is nothing to remove (or it isn't a web address).
function cleanNavigation(url) {
  if (typeof url !== 'string' || url.length > 8192 || url.indexOf('?') < 0 || !/^https?:/i.test(url)) return '';
  const q = url.indexOf('?'), hash = url.indexOf('#', q);
  const query = url.slice(q + 1, hash < 0 ? undefined : hash);
  // the rest of the address is kept exactly as it was (no re-encoding): only whole "name=value" parts are dropped
  const parts = query.split('&');
  const kept = parts.filter((p) => { const name = p.split('=')[0]; let n = name; try { n = decodeURIComponent(name); } catch { /* keep odd names */ } return !CLICK_IDS.has(n.toLowerCase()); });
  if (kept.length === parts.length) return '';
  return url.slice(0, q) + (kept.length ? `?${kept.join('&')}` : '') + (hash < 0 ? '' : url.slice(hash));
}

module.exports = { cleanNavigation, CLICK_IDS };
