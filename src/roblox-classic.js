// Oto — Classic Roblox (1.9.0): roblox.com in the look it had around 2015–2017. A style sheet Oto adds to Roblox's
// pages (nothing else on the page changes, nothing is sent anywhere): the bright blue top bar, Source Sans, the light
// grey page with white cards, blue links and buttons, green Play buttons and small square corners. Roblox's own
// logo and pictures are kept (the logo is just shown in white on the blue bar). Roblox's dark theme is shown light,
// like the site was back then. On by default; Settings › Appearance › Classic Roblox turns it off.
// The font is Source Sans 3 (SIL Open Font License, src/fonts/OFL-SourceSans3.txt), handed to the page inline.
/* global S, V, oto, bindView:writable */
const RBX_HOST = /^https?:\/\/([a-z0-9-]+\.)*roblox\.com(\/|$)/i;
const rbxOn = () => S.settings.rbxClassic !== false;
const RBX_FONT_FILES = [[400, 'fonts/source-sans-3-latin-400-normal.woff2'], [600, 'fonts/source-sans-3-latin-600-normal.woff2'], [700, 'fonts/source-sans-3-latin-700-normal.woff2']];
let rbxFontCss = null;
async function rbxFonts() {
  if (rbxFontCss !== null) return rbxFontCss;
  try {
    const faces = await Promise.all(RBX_FONT_FILES.map(async ([w, f]) => {
      // labelled as a font ourselves: on Windows a file:// read comes back as "unknown data"
      const bytes = new Uint8Array(await (await fetch(f)).arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const url = `data:font/woff2;base64,${btoa(bin)}`;
      return `@font-face{font-family:"Oto Source Sans";font-style:normal;font-weight:${w};font-display:swap;src:url(${url}) format("woff2")}`;
    }));
    rbxFontCss = faces.join('');
  } catch { rbxFontCss = ''; }
  return rbxFontCss;
}
const RBX_FONT = '"Oto Source Sans","Source Sans Pro","Source Sans 3","Segoe UI",Arial,sans-serif';
const RBX_CSS = `
body.rbx-body,body.rbx-body.light-theme,body.rbx-body.dark-theme{
--color-surface-0:#f2f2f2!important;--color-surface-100:#fff!important;--color-surface-200:#fff!important;--color-surface-300:#e3e3e3!important;
--color-content-emphasis:#191919!important;--color-content-default:#393b3d!important;--color-content-muted:#757575!important;--color-content-link:#00a2ff!important;
--color-action-emphasis-background:#00a2ff!important;--color-action-emphasis-foreground:#fff!important;--color-action-emphasis-border:#00a2ff!important;
--color-action-soft-emphasis-background:#e5f6ff!important;--color-action-soft-emphasis-foreground:#0074bd!important;
--color-action-standard-background:#fff!important;--color-action-standard-foreground:#393b3d!important;--color-action-standard-border:#b8b8b8!important;
--color-action-sub-emphasis-background:#393b3d!important;--color-action-sub-emphasis-foreground:#fff!important;
--color-action-subtle-foreground:#393b3d!important;--color-action-subtle-border:#b8b8b8!important;
--color-action-link-foreground:#00a2ff!important;--color-action-utility-foreground:#393b3d!important;
--color-stroke-default:#e3e3e3!important;--color-stroke-emphasis:#b8b8b8!important;--color-stroke-muted:#ececec!important;
--color-system-emphasis:#00a2ff!important;--color-system-success:#02b757!important;--color-system-contrast:#191919!important;
--color-shift-100:rgba(0,0,0,.03)!important;--color-shift-200:rgba(0,0,0,.05)!important;--color-shift-300:rgba(0,0,0,.08)!important;--color-shift-400:rgba(0,0,0,.11)!important;
--color-common-navigation-bar:#fff!important;--color-navigation-background:#fff!important;--color-navigation-image:none!important;
--config-theme-text-font:"Oto Source Sans"!important;--config-text-font:"Oto Source Sans"!important;
--radius-small:3px!important;--radius-medium:3px!important;--radius-large:3px!important;
color-scheme:light;background:#f2f2f2!important;color:#393b3d!important;font-family:${RBX_FONT}!important}
body.rbx-body :is(h1,h2,h3,h4,h5,h6,p,a,span,div,li,button,input,textarea,select,label,td,th,strong,b,small){font-family:${RBX_FONT}!important}
#theme-background{background:#f2f2f2!important;background-image:none!important}
body.rbx-body #wrap,body.rbx-body .container-main{background:transparent!important}
/* the top bar: bright blue, white text, white logo, a white square search box */
body.rbx-body #header,body.rbx-body .rbx-header{background:#00a2ff!important;border-bottom:0!important;box-shadow:0 1px 3px rgba(0,0,0,.25)!important}
body.rbx-body .rbx-header :is(a,.text-header,.nav-menu-title,.font-header-2,.rbx-navbar a,span:not([class*="icon"])){color:#fff!important}
body.rbx-body .rbx-header .rbx-navbar a{font-weight:400!important;font-size:16px!important}
body.rbx-body .rbx-header .rbx-navbar a:hover{text-decoration:underline!important;background:transparent!important}
body.rbx-body #nav-logo-link :is(img,svg,span,div),body.rbx-body .rbx-header [class*="icon-logo"],body.rbx-body .rbx-header [class*="icon-nav"],body.rbx-body .rbx-header #header-menu-icon *{filter:brightness(0) invert(1)!important}
body.rbx-body #navbar-search-input,body.rbx-body .rbx-header .navbar-search,body.rbx-body .rbx-header .input-group{background:#fff!important;color:#191919!important;border:0!important;border-radius:3px!important;box-shadow:none!important}
body.rbx-body #navbar-search-input::placeholder{color:#757575!important}
body.rbx-body .rbx-header .input-addon-btn,body.rbx-body .rbx-header .input-addon-btn *{color:#757575!important;filter:none!important}
/* the left menu (signed in): white, with dark text */
body.rbx-body :is(#left-navigation-container,.rbx-left-col,#navigation){background:#fff!important;border-right:1px solid #e3e3e3!important}
body.rbx-body :is(#navigation,.rbx-left-col) :is(a,.text-nav,span){color:#191919!important}
body.rbx-body :is(#navigation,.rbx-left-col) li a:hover{background:#f2f2f2!important}
/* cards and pictures: white cards with a soft shadow, small square corners */
body.rbx-body .game-card-container{background:#fff!important;border-radius:3px!important;box-shadow:0 1px 4px rgba(25,25,25,.2)!important;overflow:hidden}
body.rbx-body :is(.game-card-thumb-container,.thumbnail-2d-container,.item-card-thumb-container,.avatar-card-image,.game-card-thumb,[class*="thumbnail"] img){border-radius:3px!important}
body.rbx-body .game-card-name{color:#191919!important;font-weight:600!important;padding:0 6px!important}
body.rbx-body .game-card-info,body.rbx-body .game-card-info *{color:#757575!important}
body.rbx-body :is(h1,h2,.container-header h2,.sort-header,.font-header-1){color:#191919!important;font-weight:400!important}
body.rbx-body a:not(.btn-primary-md):not([class*="btn-"]):not(.foundation-web-button):not(.game-card-link):hover{color:#00a2ff}
/* buttons: square-ish blue, white secondary with a grey line, green Play */
body.rbx-body :is(button,a)[class*="btn-"],body.rbx-body .foundation-web-button{border-radius:3px!important}
body.rbx-body :is(.btn-primary-md,.btn-primary-lg,.btn-cta-md,.btn-cta-lg,.btn-secondary-md){font-weight:600!important}
body.rbx-body :is(.btn-common-play-game-lg,.btn-common-play-game-md,[data-testid="play-button"],#game-details-play-button-container button,.btn-growth-lg,.btn-growth-md,.btn-growth-sm,.btn-growth-xs,button.play-button){background:#02b757!important;border-color:#02b757!important;color:#fff!important;border-radius:3px!important}
body.rbx-body :is(.btn-common-play-game-lg,[data-testid="play-button"],#game-details-play-button-container button,button.play-button):hover{background:#3fc679!important;border-color:#3fc679!important}
body.rbx-body :is(.btn-common-play-game-lg,[data-testid="play-button"],#game-details-play-button-container button) *{color:#fff!important;filter:none!important}
`;
// The old ads (asked for in 1.9.0): tall ads beside the page, a banner on top and a box at the bottom, like
// 2015–2017 Roblox had. Each page shows a random set from the Roblox Wiki's user-ad gallery, fetched and kept by Oto
// (main/roblox-ads.js); without the internet, Oto's own drawings of made-up games stand in. They're only pictures:
// no links, nothing to click. The page goes back to the old fixed width in the middle so the side ads have room; on
// a narrow window they're left out. Settings › Appearance › "Old ads in Classic Roblox" turns them off.
const RBX_AD_SKY_1 = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="630" viewBox="0 0 160 630">
<text x="80" y="11" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a" letter-spacing=".5">ADVERTISEMENT</text>
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".55" stop-color="#ffb21f"/><stop offset="1" stop-color="#ffe066"/></linearGradient></defs>
<rect x="0" y="16" width="160" height="600" fill="url(#s)"/>
<g fill="#7a2b00" opacity=".25"><rect x="10" y="420" width="140" height="6"/><rect x="10" y="436" width="140" height="6"/></g>
<g stroke="#3b1500" stroke-width="2">
<rect x="58" y="250" width="44" height="40" fill="#8c3cff"/><rect x="50" y="300" width="60" height="40" fill="#25c2ff"/><rect x="42" y="350" width="76" height="40" fill="#20d36b"/><rect x="34" y="400" width="92" height="40" fill="#ff3d6e"/><rect x="26" y="450" width="108" height="40" fill="#ffd400"/>
<rect x="70" y="214" width="20" height="36" fill="#fff"/><rect x="66" y="196" width="28" height="22" fill="#ffd9a8"/></g>
<rect x="74" y="203" width="4" height="4" fill="#3b1500"/><rect x="83" y="203" width="4" height="4" fill="#3b1500"/>
<g font-family="'Arial Black',Impact,Arial,sans-serif" font-weight="900" text-anchor="middle" stroke="#3b1500" stroke-width="4" paint-order="stroke" fill="#fff">
<text x="80" y="66" font-size="30">TOWER</text><text x="80" y="98" font-size="22">OF</text><text x="80" y="132" font-size="30">DOOM</text></g>
<text x="80" y="160" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#3b1500">CAN YOU MAKE IT</text>
<text x="80" y="176" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#3b1500">TO THE TOP?</text>
<g transform="translate(20 528)"><rect width="120" height="40" rx="3" fill="#02b757" stroke="#015c2b" stroke-width="2"/><text x="60" y="27" text-anchor="middle" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="18" fill="#fff">PLAY NOW!</text></g>
<text x="80" y="590" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#7a2b00">500 levels · free</text>
<text x="158" y="628" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a">Report</text>
</svg>`;
const RBX_AD_SKY_2 = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="630" viewBox="0 0 160 630">
<text x="80" y="11" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a" letter-spacing=".5">ADVERTISEMENT</text>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a6b"/><stop offset=".6" stop-color="#1f5fd6"/><stop offset="1" stop-color="#5fd2ff"/></linearGradient></defs>
<rect x="0" y="16" width="160" height="600" fill="url(#g)"/>
<g fill="#fff"><circle cx="20" cy="40" r="1.5"/><circle cx="130" cy="60" r="1.2"/><circle cx="60" cy="90" r="1"/><circle cx="140" cy="150" r="1.5"/><circle cx="30" cy="190" r="1.2"/><circle cx="110" cy="230" r="1"/></g>
<g font-family="'Arial Black',Impact,Arial,sans-serif" font-weight="900" text-anchor="middle" stroke="#06183d" stroke-width="4" paint-order="stroke">
<text x="80" y="62" font-size="27" fill="#ffd400">PIZZA</text><text x="80" y="96" font-size="25" fill="#fff">TYCOON</text></g>
<text x="80" y="122" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#fff">BUILD YOUR OWN</text>
<text x="80" y="138" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#fff">PIZZA EMPIRE!</text>
<g transform="translate(80 270)" stroke="#5a2600" stroke-width="2">
<circle r="56" fill="#f2b34b"/><circle r="47" fill="#e8442e"/>
<g fill="#ffe7a3"><circle cx="-18" cy="-14" r="9"/><circle cx="16" cy="-22" r="8"/><circle cx="22" cy="12" r="9"/><circle cx="-14" cy="20" r="8"/><circle cx="0" cy="0" r="7"/></g>
<g fill="#7a1c10" stroke="none"><circle cx="-2" cy="-28" r="4"/><circle cx="-28" cy="4" r="4"/><circle cx="6" cy="26" r="4"/><circle cx="30" cy="-6" r="4"/></g></g>
<g stroke="#06183d" stroke-width="2"><rect x="30" y="360" width="100" height="70" fill="#ffffff"/><rect x="30" y="350" width="100" height="16" fill="#e8442e"/><rect x="66" y="396" width="28" height="34" fill="#8a4b20"/><rect x="40" y="378" width="18" height="16" fill="#9fe3ff"/><rect x="102" y="378" width="18" height="16" fill="#9fe3ff"/></g>
<text x="80" y="362" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9" fill="#fff">PIZZA</text>
<text x="80" y="470" text-anchor="middle" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="15" fill="#ffd400" stroke="#06183d" stroke-width="3" paint-order="stroke">$1,000,000</text>
<text x="80" y="488" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#fff">and counting…</text>
<g transform="translate(20 528)"><rect width="120" height="40" rx="3" fill="#02b757" stroke="#015c2b" stroke-width="2"/><text x="60" y="27" text-anchor="middle" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="18" fill="#fff">PLAY NOW!</text></g>
<text x="80" y="592" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#dff4ff">now with drive-thru</text>
<text x="158" y="628" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a">Report</text>
</svg>`;
const RBX_AD_BOARD = `<svg xmlns="http://www.w3.org/2000/svg" width="728" height="116" viewBox="0 0 728 116">
<text x="364" y="11" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a" letter-spacing=".5">ADVERTISEMENT</text>
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b0f4d"/><stop offset=".5" stop-color="#4b1f9e"/><stop offset="1" stop-color="#c2338a"/></linearGradient></defs>
<rect x="0" y="16" width="728" height="90" fill="url(#b)"/>
<g fill="#fff"><circle cx="40" cy="30" r="1.4"/><circle cx="200" cy="96" r="1.2"/><circle cx="330" cy="28" r="1"/><circle cx="520" cy="94" r="1.4"/><circle cx="600" cy="30" r="1"/><circle cx="700" cy="70" r="1.2"/></g>
<g transform="translate(70 61) rotate(-35)" stroke="#120838" stroke-width="2">
<path d="M0-34 C10-24 12-8 12 14 H-12 C-12-8-10-24 0-34Z" fill="#fff"/><circle cy="-8" r="5" fill="#5fd2ff"/>
<path d="M-12 6 L-22 20 L-12 18Z M12 6 L22 20 L12 18Z" fill="#e8442e"/><path d="M-7 16 L0 32 L7 16Z" fill="#ffd400"/></g>
<g font-family="'Arial Black',Impact,Arial,sans-serif" font-weight="900" stroke="#120838" stroke-width="4" paint-order="stroke">
<text x="130" y="58" font-size="30" fill="#ffd400">SPACE RACE</text><text x="130" y="90" font-size="22" fill="#fff">SIMULATOR</text></g>
<text x="388" y="56" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="14" fill="#fff">Blast off with your friends!</text>
<text x="388" y="78" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#e6dcff">Build a rocket · Visit 12 planets</text>
<g transform="translate(600 42)"><rect width="110" height="38" rx="3" fill="#02b757" stroke="#015c2b" stroke-width="2"/><text x="55" y="26" text-anchor="middle" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="17" fill="#fff">PLAY NOW!</text></g>
<text x="726" y="114" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a">Report</text>
</svg>`;
const rbxAdsOn = () => S.settings.rbxAds !== false;
const rbxSvg = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const RBX_AD_LABEL = rbxSvg('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="14"><text x="150" y="11" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a" letter-spacing=".5">ADVERTISEMENT</text></svg>');
const RBX_AD_REPORT = rbxSvg('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="12"><text x="58" y="10" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#9a9a9a">Report</text></svg>');
// a picture from the gallery gets the old "ADVERTISEMENT" label above it and "Report" below; Oto's drawings have them built in
const rbxAdBg = (pic, w, h) => (pic ? `${RBX_AD_LABEL} center top/300px 14px no-repeat,${RBX_AD_REPORT} right bottom/60px 12px no-repeat,url("${pic}") center 16px/${w}px ${h}px no-repeat` : '');
const RBX_ADS_CSS = (ads = {}) => `
body.rbx-body #content{max-width:1000px!important;margin-left:auto!important;margin-right:auto!important}
body.rbx-body #content::before{content:"";display:block;width:728px;max-width:100%;height:120px;margin:14px auto 6px;pointer-events:none;background:${rbxAdBg(ads.board, 728, 90) || `${rbxSvg(RBX_AD_BOARD)} center/contain no-repeat`}}
body.rbx-body #content::after{content:"";display:block;clear:both;width:300px;height:280px;margin:24px auto 30px;pointer-events:none;background:${rbxAdBg(ads.rect, 300, 250) || 'none'}${ads.rect ? '' : ';display:none'}}
@media (min-width:1380px){
body.rbx-body::before,body.rbx-body::after{content:"";position:fixed;top:64px;width:160px;height:630px;z-index:2;pointer-events:none}
body.rbx-body::before{left:calc(50% - 500px - 180px);background:${rbxAdBg(ads.sky1, 160, 600) || `${rbxSvg(RBX_AD_SKY_1)} center/contain no-repeat`}}
body.rbx-body::after{right:calc(50% - 500px - 180px);background:${rbxAdBg(ads.sky2, 160, 600) || `${rbxSvg(RBX_AD_SKY_2)} center/contain no-repeat`}}}
@media (max-height:700px){body.rbx-body::before,body.rbx-body::after{display:none!important}}
`;
const rbxPic = (u) => (typeof u === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
async function rbxAdPics() {
  try { const r = (typeof oto !== 'undefined' && oto.rbxAds) ? await oto.rbxAds() : null; return r ? { sky1: rbxPic(r.sky1), sky2: rbxPic(r.sky2), board: rbxPic(r.board), rect: rbxPic(r.rect) } : {}; } catch { return {}; }
}
async function rbxApply(v) {
  if (!v || !v.wv) return;
  let url = '';
  try { url = v.wv.getURL(); } catch { return; }
  if (v.rbxKey) { try { await v.wv.removeInsertedCSS(v.rbxKey); } catch {} v.rbxKey = null; }
  if (!RBX_HOST.test(url) || !rbxOn()) return;
  const ads = rbxAdsOn() ? RBX_ADS_CSS(await rbxAdPics()) : '';
  try { if (v.rbxKey) { await v.wv.removeInsertedCSS(v.rbxKey); v.rbxKey = null; } v.rbxKey = await v.wv.insertCSS((await rbxFonts()) + RBX_CSS + ads); } catch {}
}
function rbxRefresh() { for (const v of V.values()) if (v && v.ready) rbxApply(v); }
let rbxReady = false;
function initRobloxClassic() {
  if (rbxReady || typeof bindView !== 'function') return;
  rbxReady = true;
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    try { v.wv.addEventListener('dom-ready', () => { v.rbxKey = null; rbxApply(v); }); } catch {}
  };
  rbxFonts(); // read the font once, early
}
if (typeof S !== 'undefined' && typeof bindView === 'function') initRobloxClassic();
