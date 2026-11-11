'use strict';
// Oto Shield protection levels: Standard, Strict and Custom.
//
// A level is a set of protections. Standard and Strict are fixed sets; Custom is whatever the switches say.
//   lists      which filter lists the blocker uses: 'basic' (ads), 'balanced' (ads + trackers),
//              'strict' (+ cookie banners, popups, "turn off your adblocker" walls)
//   recorders  block session recorders (products that record what you do on a page)
//   fp         fingerprint protection (canvas, WebGL, audio and battery answers change per site and per session)
//   webrtc     what a call (WebRTC) may learn about your network:
//                'off'    Chromium's default: every network connection of this PC can be found (also your real
//                         address when you use a VPN)
//                'route'  only the connection your traffic really uses (and its address on your home network, which
//                         Chromium hides behind a random name)
//                'public' only that connection's public address; nothing about your home network
//
// Settings from before 1.5 keep working: the old "level" (basic / balanced / strict) and "fp" switch are read as they
// were. Balanced becomes Standard, Strict stays Strict, and anything else (Basic, or fingerprint protection switched
// off) becomes Custom with exactly the same protections as before.
const LISTS = ['basic', 'balanced', 'strict'];
const WEBRTC = { off: 'default', route: 'default_public_and_private_interfaces', public: 'default_public_interface_only' };
const PRESETS = {
  standard: { lists: 'balanced', recorders: true, fp: true, webrtc: 'route' },
  strict: { lists: 'strict', recorders: true, fp: true, webrtc: 'public' },
};
const listsOf = (conf) => (LISTS.includes(conf.level) ? conf.level : conf.annoy ? 'strict' : 'balanced');

function modeOf(conf) {
  conf = conf || {};
  if (conf.mode === 'standard' || conf.mode === 'strict' || conf.mode === 'custom') return conf.mode;
  const lists = listsOf(conf);
  if (conf.fp === false || lists === 'basic') return 'custom';
  return lists === 'strict' ? 'strict' : 'standard';
}

function featuresOf(conf) {
  conf = conf || {};
  const mode = modeOf(conf);
  if (PRESETS[mode]) return { mode, ...PRESETS[mode] };
  const lists = listsOf(conf);
  return {
    mode, lists,
    recorders: typeof conf.recorders === 'boolean' ? conf.recorders : lists !== 'basic',
    fp: conf.fp !== false,
    webrtc: WEBRTC[conf.webrtc] ? conf.webrtc : 'route',
  };
}

// Choose a level. Custom starts from the protections that are on right now, so choosing it changes nothing by itself.
// The old names still work: 'balanced' is Standard, 'basic' is Custom with trackers left alone.
function setMode(conf, mode) {
  if (mode === 'balanced') mode = 'standard';
  if (mode === 'basic') { setMode(conf, 'custom'); conf.recorders = false; return setFeature(conf, 'trackers', false); } // "ads only", as it was
  if (PRESETS[mode]) {
    conf.mode = mode; conf.level = PRESETS[mode].lists; conf.annoy = mode === 'strict'; conf.fp = true;
    delete conf.recorders; delete conf.webrtc;
    return true;
  }
  if (mode !== 'custom') return false;
  const f = featuresOf(conf);
  conf.mode = 'custom'; conf.level = f.lists; conf.annoy = f.lists === 'strict'; conf.fp = f.fp; conf.recorders = f.recorders; conf.webrtc = f.webrtc;
  return true;
}

// Flip one protection. This always ends in Custom.
function setFeature(conf, name, value) {
  if (!['trackers', 'annoyances', 'recorders', 'fp', 'webrtc'].includes(name)) return false;
  if (name === 'webrtc' ? !WEBRTC[value] : typeof value !== 'boolean') return false;
  if (modeOf(conf) !== 'custom' || conf.mode !== 'custom') setMode(conf, 'custom');
  if (name === 'trackers') conf.level = value ? (conf.level === 'basic' ? 'balanced' : conf.level) : 'basic';
  else if (name === 'annoyances') conf.level = value ? 'strict' : (conf.level === 'strict' ? 'balanced' : conf.level);
  else conf[name] = value;
  conf.annoy = conf.level === 'strict';
  return true;
}

// The WebRTC setting Chromium gets for a page. Shield off (everywhere or for that site) means Chromium's default.
const webrtcPolicy = (features, off) => (off ? WEBRTC.off : WEBRTC[features.webrtc] || WEBRTC.route);

module.exports = { modeOf, featuresOf, setMode, setFeature, webrtcPolicy, PRESETS, WEBRTC };
