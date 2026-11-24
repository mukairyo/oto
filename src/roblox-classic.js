// Oto — Classic Roblox (1.9.0): roblox.com in the look it had in a year you pick, from 2010 to 2017. A style sheet Oto adds to Roblox's
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
// Each year's look, measured from the Internet Archive's copies of roblox.com's games page (mid-year): the top bar,
// the page and content colours, the content width, boxes, buttons and the font. 2016 and 2017 looked the same there.
const RBX_YEARS = {
  2010: { font: 'Verdana,Geneva,sans-serif', text: '#000', muted: '#555', link: '#0000ff', page: '#f8fcff', pageImg: 'linear-gradient(#bfe0ff,#f8fcff 420px)', panel: '#e5f1fd', width: 900,
    bar: '#6e99c9', barImg: 'linear-gradient(#83aad6,#6e99c9 55%,#5a86b8)', barLine: '#3d6a9f', barText: '#fff', barWeight: 700, barSize: 15, navFont: 'Arial,Helvetica,sans-serif',
    card: { bg: '#fff', border: '2px solid #6e99c9', radius: 0, shadow: 'none' }, head: '#2a4f80',
    btn: { bg: 'linear-gradient(#ffffff,#d6d6d6)', border: '1px solid #777', color: '#000', radius: 0 }, emph: { bg: 'linear-gradient(#83aad6,#4d7bb0)', border: '1px solid #3d6a9f', color: '#fff' },
    play: { bg: 'linear-gradient(#5fd35f,#22a322)', border: '1px solid #157a15', radius: 2 } },
  2011: { font: 'Arial,Helvetica,sans-serif', text: '#000', muted: '#666', link: '#0055b3', page: '#000444', pageImg: 'radial-gradient(ellipse at 50% 0,#173a8a,#000444 70%)', panel: '#fff', width: 900,
    bar: '#1d5fb0', barImg: 'linear-gradient(#5b9be0,#2a6fc4 50%,#1a58a8 51%,#1d5fb0)', barLine: '#0b2f66', barText: '#fff', barWeight: 700, barSize: 15, navFont: 'Arial,Helvetica,sans-serif',
    card: { bg: '#fff', border: '1px solid #aaa', radius: 0, shadow: 'none' }, head: '#333',
    btn: { bg: '#fff', border: '1px solid #333', color: '#333', radius: 0 }, emph: { bg: 'linear-gradient(#5b9be0,#1d5fb0)', border: '1px solid #0b2f66', color: '#fff' },
    play: { bg: 'linear-gradient(#6fd36f,#2aa52a)', border: '1px solid #167a16', radius: 3 } },
  2012: { font: 'Arial,Helvetica,sans-serif', text: '#000', muted: '#666', link: '#0055b3', page: '#e6e6e6', pageImg: 'none', panel: '#fff', width: 970,
    bar: '#114081', barImg: 'linear-gradient(#114081 0,#114081 10px,#5b9be0 10px,#2a6fc4 25px,#1a58a8 26px,#1d5fb0)', barLine: '#0b2f66', barText: '#fff', barWeight: 700, barSize: 16, navFont: 'Arial,Helvetica,sans-serif',
    card: { bg: '#fff', border: '1px solid #aaa', radius: 0, shadow: 'none' }, head: '#333',
    btn: { bg: '#fff', border: '1px solid #333', color: '#333', radius: 0 }, emph: { bg: 'linear-gradient(#5b9be0,#1d5fb0)', border: '1px solid #0b2f66', color: '#fff' },
    play: { bg: 'linear-gradient(#6fd36f,#2aa52a)', border: '1px solid #167a16', radius: 3 } },
  2013: { font: 'Arial,Helvetica,sans-serif', text: '#000', muted: '#666', link: '#0055b3', page: '#e6e6e6', pageImg: 'none', panel: '#fff', width: 970,
    bar: '#114081', barImg: 'linear-gradient(#2a5aa5,#114081)', barLine: '#082a5c', barText: '#fff', barWeight: 700, barSize: 13, navFont: 'Arial,Helvetica,sans-serif',
    card: { bg: '#fff', border: '1px solid #ccc', radius: 0, shadow: 'none' }, head: '#333',
    btn: { bg: 'linear-gradient(#fff,#e9e9e9)', border: '1px solid #aaa', color: '#333', radius: 3 }, emph: { bg: 'linear-gradient(#3d86d8,#1b5cb0)', border: '1px solid #114081', color: '#fff' },
    play: { bg: 'linear-gradient(#5fcf5f,#2a9c2a)', border: '1px solid #1c7a1c', radius: 3 } },
  2014: { font: RBX_FONT, text: '#343434', muted: '#777', link: '#0852b7', page: '#fff', pageImg: 'none', panel: '#fff', width: 970,
    bar: '#2d528f', barImg: 'none', barLine: '#1f3d6e', barText: '#fff', barWeight: 400, barSize: 16, navFont: RBX_FONT,
    card: { bg: '#fff', border: '1px solid #ddd', radius: 0, shadow: 'none' }, head: '#343434',
    btn: { bg: '#fff', border: '1px solid #ccc', color: '#343434', radius: 0 }, emph: { bg: 'linear-gradient(#2f76d6,#0852b7)', border: '1px solid #0852b7', color: '#fff' },
    play: { bg: '#02b757', border: '1px solid #02a04c', radius: 0 } },
  2015: { font: RBX_FONT, text: '#191919', muted: '#757575', link: '#00a2ff', page: '#f2f2f2', pageImg: 'none', panel: 'transparent', width: 970,
    bar: '#0074bd', barImg: 'none', barLine: '#0074bd', barText: '#fff', barWeight: 400, barSize: 16, navFont: RBX_FONT,
    card: { bg: '#fff', border: '0', radius: 3, shadow: '0 1px 4px rgba(25,25,25,.2)' }, head: '#191919',
    btn: { bg: '#fff', border: '1px solid #b8b8b8', color: '#393b3d', radius: 3 }, emph: { bg: '#00a2ff', border: '1px solid #00a2ff', color: '#fff' },
    play: { bg: '#02b757', border: '1px solid #02b757', radius: 3 } },
  2016: { font: RBX_FONT, text: '#191919', muted: '#757575', link: '#00a2ff', page: '#e3e3e3', pageImg: 'none', panel: 'transparent', width: 970,
    bar: '#0074bd', barImg: 'none', barLine: '#0074bd', barText: '#fff', barWeight: 400, barSize: 16, navFont: RBX_FONT,
    card: { bg: '#fff', border: '0', radius: 3, shadow: '0 1px 4px rgba(25,25,25,.2)' }, head: '#191919',
    btn: { bg: '#fff', border: '1px solid #b8b8b8', color: '#393b3d', radius: 3 }, emph: { bg: '#00a2ff', border: '1px solid #00a2ff', color: '#fff' },
    play: { bg: '#02b757', border: '1px solid #02b757', radius: 3 } },
};
RBX_YEARS[2017] = RBX_YEARS[2016];
const RBX_YEAR_LIST = Object.keys(RBX_YEARS).map(Number);
const rbxYear = () => { const y = +S.settings.rbxYear; return RBX_YEARS[y] ? y : 2016; };
// The signed-in menu. Roblox draws it as a 289px column on the left (on the page colour, so it went dark in 2011)
// and keeps that much of the page free for it. Up to 2014 there was no such column: the same links sat in a second
// bar under the top bar, so for those years the column becomes that bar and the page gets its full width back.
// From 2015 it was a narrow white column, 175px wide.
const RBX_SUBBARS = {
  2010: { bg: 'linear-gradient(#4f7db3,#3d6a9f)', line: '#2c5384', color: '#fff', sep: 'rgba(255,255,255,.22)', font: '700 12px/28px Arial,Helvetica,sans-serif', on: 'rgba(255,255,255,.18)' },
  2011: { bg: 'linear-gradient(#f7f7f7,#d8d8d8)', line: '#a9a9a9', color: '#222', sep: '#b9b9b9', font: '700 12px/28px Arial,Helvetica,sans-serif', on: 'rgba(0,0,0,.08)' },
  2012: { bg: 'linear-gradient(#f7f7f7,#d8d8d8)', line: '#a9a9a9', color: '#222', sep: '#b9b9b9', font: '700 12px/28px Arial,Helvetica,sans-serif', on: 'rgba(0,0,0,.08)' },
  2013: { bg: 'linear-gradient(#fdfdfd,#e4e4e4)', line: '#bdbdbd', color: '#333', sep: '#cfcfcf', font: '700 12px/28px Arial,Helvetica,sans-serif', on: 'rgba(0,0,0,.07)' },
  2014: { bg: '#f2f2f2', line: '#d6d6d6', color: '#343434', sep: '#dcdcdc', font: `400 15px/28px ${RBX_FONT}`, on: 'rgba(0,0,0,.06)' },
};
function rbxNavCss(year, Y) {
  const N = 'body.rbx-body #left-navigation-container .left-nav', I = `${N} nav>ul>li .text-title-large`;
  const both = `${N}>div>:not(:first-child){display:none!important}
${I}>span:not(.fill){font:inherit!important;color:inherit!important}
${N} nav>ul>li:not(:has(.text-title-large)) :is(p,span,div,a){color:${Y.text}!important}`;
  const B = RBX_SUBBARS[year];
  if (B) {
    return `/* the signed-in menu, as the bar under the top bar */
body.rbx-body #wrap.logged-in,body.rbx-body .logged-in{--left-nav-reserved-width:0px!important}
body.rbx-body #wrap.logged-in main.container-main{margin-top:43px!important}
${N}{position:fixed!important;top:40px!important;left:0!important;right:0!important;width:auto!important;height:29px!important;visibility:visible!important;transform:none!important;background:${B.bg}!important;border-bottom:1px solid ${B.line}!important;z-index:1000!important;overflow:hidden!important;box-shadow:0 1px 2px rgba(0,0,0,.12)!important}
${N}>div,${N}>div>div:first-child{width:auto!important;height:28px!important;overflow:hidden!important;flex:1 1 auto}
${N}>div>div>div{padding:0!important;gap:0!important}
${N} nav>ul{flex-direction:row!important;flex-wrap:nowrap!important;justify-content:center!important;gap:0!important;padding:0!important;margin:0!important}
${N} nav>ul>li{margin:0!important}
${N} nav>ul>li:not(:has(.text-title-large)),${N} nav>ul>li:first-child{display:none!important}
${I}{height:28px!important;padding:0 12px!important;gap:0!important;border-radius:0!important;border-left:1px solid ${B.sep}!important;color:${B.color}!important;font:${B.font}!important;background:none!important;white-space:nowrap}
${N} nav>ul>li:has(.text-title-large):last-of-type .text-title-large{border-right:1px solid ${B.sep}!important}
${I}>span[class*="size-1000"],${I}>[role="presentation"]{display:none!important}
${I}:hover{text-decoration:underline!important}
${I}.bg-shift-200{background:${B.on}!important}
${I} .fill{padding:0 0 0 5px!important;flex:none!important}
${both}
body.rbx-body:has(#wrap.logged-in)::before,body.rbx-body:has(#wrap.logged-in)::after{top:93px!important}`;
  }
  return `/* the signed-in menu, as the narrow white column of 2015–2017 */
@media (min-width:1141px){body.rbx-body #wrap.logged-in,body.rbx-body .logged-in{--left-nav-reserved-width:175px!important}}
${N}{background:#fff!important;border-right:1px solid #dcdcdc!important;box-shadow:none!important}
${N}>div,${N}>div>div:first-child{width:175px!important}
${N}>div>div>div{padding:8px 6px!important;gap:8px!important}
${N} nav>ul{gap:1px!important}
${I}{font:400 16px/1.25 ${RBX_FONT}!important;color:#191919!important;border-radius:0!important;padding:5px 6px!important;gap:8px!important;min-height:36px}
${I}>span[class*="size-1000"]{width:26px!important;height:26px!important;opacity:.75}
${I}.bg-shift-200{background:#f2f2f2!important;box-shadow:inset 3px 0 0 ${Y.bar}}
${N} .radius-circle{width:28px!important;height:28px!important}
${both}
@media (min-width:1141px){
body.rbx-body:has(#wrap.logged-in)::before{left:calc(175px + (100vw - 175px) / 2 - var(--rbx-w,970px) / 2 - 180px)!important}
body.rbx-body:has(#wrap.logged-in)::after{right:calc((100vw - 175px) / 2 - var(--rbx-w,970px) / 2 - 180px)!important}}
@media (max-width:1559px){body.rbx-body:has(#wrap.logged-in)::before,body.rbx-body:has(#wrap.logged-in)::after{display:none!important}}`;
}
function rbxCss(asked = rbxYear()) {
  const year = RBX_YEARS[asked] ? Number(asked) : 2016, Y = RBX_YEARS[year];
  const r = (n) => `${n}px`;
  return `
:root{--oto-rbx:${year}}
body.rbx-body,body.rbx-body.light-theme,body.rbx-body.dark-theme{
--color-surface-0:${Y.page}!important;--color-surface-100:#fff!important;--color-surface-200:#fff!important;--color-surface-300:#e3e3e3!important;
--color-content-emphasis:${Y.text}!important;--color-content-default:${Y.text}!important;--color-content-muted:${Y.muted}!important;--color-content-link:${Y.link}!important;
--color-action-emphasis-foreground:${Y.emph.color}!important;--color-action-standard-background:#fff!important;--color-action-standard-foreground:${Y.btn.color}!important;
--color-action-link-foreground:${Y.link}!important;--color-action-utility-foreground:${Y.text}!important;--color-action-subtle-foreground:${Y.text}!important;
--color-stroke-default:#dcdcdc!important;--color-stroke-emphasis:#b8b8b8!important;--color-stroke-muted:#ececec!important;
--color-system-emphasis:${Y.link}!important;--color-system-success:#02b757!important;--color-system-contrast:${Y.text}!important;
--color-shift-100:rgba(0,0,0,.03)!important;--color-shift-200:rgba(0,0,0,.05)!important;--color-shift-300:rgba(0,0,0,.08)!important;--color-shift-400:rgba(0,0,0,.11)!important;
--color-common-navigation-bar:#fff!important;--color-navigation-background:#fff!important;--color-navigation-image:none!important;
--config-theme-text-font:"Oto Source Sans"!important;--config-text-font:"Oto Source Sans"!important;
--radius-small:${r(Y.card.radius)}!important;--radius-medium:${r(Y.card.radius)}!important;--radius-large:${r(Y.card.radius)}!important;
--rbx-w:${Y.width}px;color-scheme:light;background:${Y.page} ${Y.pageImg === 'none' ? '' : Y.pageImg}!important;background-attachment:fixed!important;color:${Y.text}!important;font-family:${Y.font}!important}
body.rbx-body :is(h1,h2,h3,h4,h5,h6,p,a,span,div,li,button,input,textarea,select,label,td,th,strong,b,small){font-family:${Y.font}!important}
#theme-background{background:transparent!important;background-image:none!important}
body.rbx-body #wrap{background:transparent!important}
body.rbx-body #content{max-width:var(--rbx-w)!important;margin-left:auto!important;margin-right:auto!important;background:${Y.panel}!important;${Y.panel === 'transparent' ? '' : `padding:12px 18px 24px!important;box-shadow:0 0 0 1px rgba(0,0,0,.08);--color-surface-0:${Y.panel}!important;`}}
/* the top bar */
body.rbx-body #header,body.rbx-body .rbx-header{background:${Y.bar} ${Y.barImg === 'none' ? '' : Y.barImg}!important;border-bottom:1px solid ${Y.barLine}!important;box-shadow:0 1px 3px rgba(0,0,0,.25)!important}
body.rbx-body .rbx-header :is(a,.text-header,.nav-menu-title,.font-header-2,.rbx-navbar a,span:not([class*="icon"])){color:${Y.barText}!important;font-family:${Y.navFont}!important}
body.rbx-body .rbx-header .rbx-navbar a{font-weight:${Y.barWeight}!important;font-size:${Y.barSize}px!important}
body.rbx-body .rbx-header .rbx-navbar a:hover{text-decoration:underline!important;background:transparent!important}
body.rbx-body #nav-logo-link :is(img,svg,span,div),body.rbx-body .rbx-header [class*="icon-logo"],body.rbx-body .rbx-header [class*="icon-nav"],body.rbx-body .rbx-header #header-menu-icon *{filter:brightness(0) invert(1)!important}
body.rbx-body #navbar-search-input,body.rbx-body .rbx-header .navbar-search,body.rbx-body .rbx-header .input-group{background:#fff!important;color:#191919!important;border:0!important;border-radius:${r(Math.min(3, Y.card.radius))}!important;box-shadow:none!important}
body.rbx-body #navbar-search-input::placeholder{color:#757575!important}
body.rbx-body .rbx-header .input-addon-btn,body.rbx-body .rbx-header .input-addon-btn *{color:#757575!important;filter:none!important}
${rbxNavCss(year, Y)}
/* boxes, pictures and headings */
body.rbx-body .game-card-container{background:${Y.card.bg}!important;border:${Y.card.border}!important;border-radius:${r(Y.card.radius)}!important;box-shadow:${Y.card.shadow}!important;overflow:hidden}
body.rbx-body :is(.game-card-thumb-container,.thumbnail-2d-container,.item-card-thumb-container,.avatar-card-image,.game-card-thumb,[class*="thumbnail"] img){border-radius:${r(Y.card.radius)}!important}
body.rbx-body .game-card-name{color:${Y.text}!important;font-weight:${year <= 2013 ? 700 : 600}!important;padding:0 6px!important}
body.rbx-body .game-card-info,body.rbx-body .game-card-info *{color:${Y.muted}!important}
body.rbx-body :is(h1,h2,.container-header h2,.sort-header,.font-header-1){color:${Y.head}!important;font-weight:${year <= 2014 ? 700 : 400}!important}
body.rbx-body a:not([class*="btn-"]):not(.foundation-web-button):not(.game-card-link):hover{color:${Y.link}}
${year <= 2012 ? `body.rbx-body #content a:not([class*="btn-"]):not(.foundation-web-button):not(.game-card-link){color:${Y.link}!important}` : ''}
/* buttons */
body.rbx-body :is(button,a)[class*="btn-"],body.rbx-body .foundation-web-button{border-radius:${r(Y.btn.radius)}!important}
body.rbx-body :is(.btn-secondary-md,.btn-control-md,.btn-control-sm,.btn-secondary-lg){background:${Y.btn.bg}!important;border:${Y.btn.border}!important;color:${Y.btn.color}!important}
body.rbx-body :is(.btn-primary-md,.btn-primary-lg,.btn-cta-md,.btn-cta-lg){background:${Y.emph.bg}!important;border:${Y.emph.border}!important;color:${Y.emph.color}!important;font-weight:600!important}
body.rbx-body :is(.btn-common-play-game-lg,.btn-common-play-game-md,[data-testid="play-button"],#game-details-play-button-container button,.btn-growth-lg,.btn-growth-md,.btn-growth-sm,.btn-growth-xs,button.play-button){background:${Y.play.bg}!important;border:${Y.play.border}!important;color:#fff!important;border-radius:${r(Y.play.radius)}!important}
body.rbx-body :is(.btn-common-play-game-lg,[data-testid="play-button"],#game-details-play-button-container button,button.play-button):hover{filter:brightness(1.08)!important}
body.rbx-body :is(.btn-common-play-game-lg,[data-testid="play-button"],#game-details-play-button-container button) *{color:#fff!important;filter:none!important}
`;
}
const RBX_CSS = rbxCss(2016); // kept for the tests: the 2016 look
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
body.rbx-body #content::before{content:"";display:block;width:728px;max-width:100%;height:120px;margin:14px auto 6px;pointer-events:none;background:${rbxAdBg(ads.board, 728, 90) || `${rbxSvg(RBX_AD_BOARD)} center/contain no-repeat`}}
body.rbx-body #content::after{content:"";display:block;clear:both;width:300px;height:280px;margin:24px auto 30px;pointer-events:none;background:${rbxAdBg(ads.rect, 300, 250) || 'none'}${ads.rect ? '' : ';display:none'}}
@media (min-width:1360px){
body.rbx-body::before,body.rbx-body::after{content:"";position:fixed;top:64px;width:160px;height:630px;z-index:2;pointer-events:none}
body.rbx-body::before{left:calc(50% - var(--rbx-w,970px) / 2 - 180px);background:${rbxAdBg(ads.sky1, 160, 600) || `${rbxSvg(RBX_AD_SKY_1)} center/contain no-repeat`}}
body.rbx-body::after{right:calc(50% - var(--rbx-w,970px) / 2 - 180px);background:${rbxAdBg(ads.sky2, 160, 600) || `${rbxSvg(RBX_AD_SKY_2)} center/contain no-repeat`}}}
@media (max-height:700px){body.rbx-body::before,body.rbx-body::after{display:none!important}}
`;
const rbxPic = (u) => (typeof u === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
async function rbxAdPics() {
  try { const r = (typeof oto !== 'undefined' && oto.rbxAds) ? await oto.rbxAds() : null; return r ? { sky1: rbxPic(r.sky1), sky2: rbxPic(r.sky2), board: rbxPic(r.board), rect: rbxPic(r.rect) } : {}; } catch { return {}; }
}
// The look goes on the moment a page is ready and never waits for anything from the web (1.9.1). Before, it waited
// for the ad pictures from the Roblox Wiki; when the Wiki was slow or never answered, roblox.com stayed as it is today
// until Settings put the look on again. Now the ads start as Oto's own drawings (or the pictures from the last page)
// and the gallery pictures swap in when they come, within 10 seconds or not at all.
const rbxWait = (p, ms, fallback) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
let rbxAdsCache = null;
// put a style sheet in, then take the old one out (no flash); '' just takes it out
async function rbxSwap(v, k, css) {
  let key = null;
  if (css) { try { key = await v.wv.insertCSS(css); } catch {} }
  const old = v[k]; v[k] = key;
  if (old) { try { await v.wv.removeInsertedCSS(old); } catch {} }
}
async function rbxApply(v) {
  if (!v || !v.wv) return;
  let url = '';
  try { url = v.wv.getURL(); } catch { return; }
  const run = v.rbxRun = (v.rbxRun || 0) + 1; // a newer run (next page, a setting changed) wins
  if (!RBX_HOST.test(url) || !rbxOn()) { await rbxSwap(v, 'rbxKey', ''); await rbxSwap(v, 'rbxAdsKey', ''); return; }
  const fonts = await rbxWait(rbxFonts(), 1500, '');
  if (run !== v.rbxRun) return;
  await rbxSwap(v, 'rbxKey', fonts + rbxCss(rbxYear()));
  if (!fonts) rbxFonts().then((f) => { if (f && run === v.rbxRun) rbxSwap(v, 'rbxKey', f + rbxCss(rbxYear())); }); // the font came late
  if (!rbxAdsOn()) { await rbxSwap(v, 'rbxAdsKey', ''); return; }
  const had = rbxAdsCache;
  await rbxSwap(v, 'rbxAdsKey', RBX_ADS_CSS(had || {}));
  const pics = await rbxWait(rbxAdPics(), 10000, {});
  if (!Object.values(pics).some(Boolean)) return;
  rbxAdsCache = pics; // new pictures for the next page
  if (!had && run === v.rbxRun && rbxAdsOn()) await rbxSwap(v, 'rbxAdsKey', RBX_ADS_CSS(pics));
}
// The look carries a marker (--oto-rbx: the year). If a page comes up without it (seen on real roblox.com when going
// from Home to Profile, Messages or Communities: the page stayed as today's Roblox until Settings put the look on
// again), the look goes back on by itself. Reading one style value is all this does in the page.
async function rbxCheck(v) {
  if (!v || !v.wv || !rbxOn()) return;
  let url = '';
  try { url = v.wv.getURL(); } catch { return; }
  if (!RBX_HOST.test(url)) return;
  let mark = '';
  try { mark = await v.wv.executeJavaScript("getComputedStyle(document.documentElement).getPropertyValue('--oto-rbx').trim()"); } catch { return; }
  if (String(mark) !== String(rbxYear())) { v.rbxKey = null; v.rbxAdsKey = null; rbxApply(v); }
}
function rbxRefresh() { for (const v of V.values()) if (v && v.ready) rbxApply(v); }
let rbxReady = false;
function initRobloxClassic() {
  if (rbxReady || typeof bindView !== 'function') return;
  rbxReady = true;
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    try {
      v.wv.addEventListener('dom-ready', () => { v.rbxKey = null; v.rbxAdsKey = null; rbxApply(v); }); // a new page starts without our sheets
      // the safety net: after every page change and finished load, look for the marker and put the look back if it's gone
      const later = () => { clearTimeout(v.rbxT1); clearTimeout(v.rbxT2); v.rbxT1 = setTimeout(() => rbxCheck(v), 400); v.rbxT2 = setTimeout(() => rbxCheck(v), 2000); };
      v.wv.addEventListener('did-navigate', later);
      v.wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) later(); });
      v.wv.addEventListener('did-stop-loading', later);
    } catch {}
  };
  rbxFonts(); // read the font once, early
}
if (typeof S !== 'undefined' && typeof bindView === 'function') initRobloxClassic();
