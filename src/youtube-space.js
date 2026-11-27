'use strict';
// YouTube in Oto's look (1.9.1): youtube.com (the site itself, not Music, Studio, Kids or the phone site) dressed
// like Oto's space sidebar: near-black with a field of stars, cream-white highlights, hairline borders, Instrument
// Serif titles and small spaced-out mono labels with numbers ("01  EXPLORE"), and the active entry lit like the
// active tab. The fonts are Oto's own (OFL), handed to the page inline; the stars are drawn in CSS. Nothing is loaded
// from the web and no script runs in the page. Settings › Appearance › Websites turns it off.
const YTS_HOST = /^https:\/\/(www\.)?youtube\.com(\/|$)/i;
const ytsOn = () => S.settings.ytSpace !== false;
const YTS_FONT_FILES = [
  ['Oto Instrument Serif', 400, 'normal', 'fonts/instrument-serif-latin-400-normal.woff2'],
  ['Oto Instrument Serif', 400, 'italic', 'fonts/instrument-serif-latin-400-italic.woff2'],
  ['Oto JetBrains Mono', 400, 'normal', 'fonts/jetbrains-mono-latin-400-normal.woff2'],
  ['Oto JetBrains Mono', 500, 'normal', 'fonts/jetbrains-mono-latin-500-normal.woff2'],
];
let ytsFontCss = null;
async function ytsFonts() {
  if (ytsFontCss !== null) return ytsFontCss;
  try {
    const faces = await Promise.all(YTS_FONT_FILES.map(async ([family, w, style, f]) => {
      // labelled as a font ourselves: on Windows a file:// read comes back as "unknown data"
      const bytes = new Uint8Array(await (await fetch(f)).arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return `@font-face{font-family:"${family}";font-style:${style};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2")}`;
    }));
    ytsFontCss = faces.join('');
  } catch { ytsFontCss = ''; }
  return ytsFontCss;
}

// Oto's space-sidebar colours (the same as the sidebar's own)
const YTS = { bg: '#0b0b0c', panel: '#0f0f11', raise: '#141416', menu: '#161618', line: 'rgba(255,255,255,.075)', line2: 'rgba(255,255,255,.14)',
  fg: '#ece8e1', fg2: 'rgba(236,232,225,.64)', fg3: 'rgba(236,232,225,.38)', cream: '#e7dfd1', ink: '#131313' };
const YTS_SERIF = '"Oto Instrument Serif","Instrument Serif",Georgia,"Times New Roman",serif';
const YTS_MONO = '"Oto JetBrains Mono","JetBrains Mono","Cascadia Mono",Consolas,monospace';
// three layers of stars that repeat at different sizes, so the pattern never lines up; plus a faint glow at the top
const ytsDots = (size, dots) => dots.map(([x, y, r, a]) => `radial-gradient(${r}px ${r}px at ${x}px ${y}px,rgba(255,255,255,${a}),transparent 70%)`).map((g) => [g, size]);
const YTS_STAR_LAYERS = [
  ...ytsDots(263, [[23, 41, 1.2, .55], [151, 97, 1, .35], [92, 188, 1.6, .7], [219, 230, 1, .3], [57, 129, 1, .25]]),
  ...ytsDots(419, [[310, 60, 1.3, .5], [40, 300, 1, .4], [201, 377, 1.8, .8], [377, 214, 1, .3]]),
  ...ytsDots(601, [[480, 130, 1.1, .45], [130, 520, 1.4, .6], [560, 470, 1, .3], [290, 300, 2, .9]]),
  ['radial-gradient(ellipse 80% 50% at 50% -10%,rgba(255,255,255,.045),transparent 70%)', '100% 100%'],
];
const YTS_STARS = `background-color:${YTS.bg}!important;background-image:${YTS_STAR_LAYERS.map((l) => l[0]).join(',')}!important;background-size:${YTS_STAR_LAYERS.map((l) => (typeof l[1] === 'number' ? `${l[1]}px ${l[1]}px` : l[1])).join(',')}!important;background-attachment:fixed!important`;

function ytsCss() {
  const C = YTS;
  const sys = (k, v) => `--yt-sys-color-baseline--${k}:${v}!important;`;
  const spec = (k, v) => `--yt-spec-${k}:${v}!important;`;
  const colors = [
    ['base-background', 'transparent'], ['raised-background', C.raise], ['surface-container', C.panel], ['menu-background', C.menu],
    ['additive-background', 'rgba(255,255,255,.05)'], ['outline', C.line2], ['outline-opaque', '#262628'], ['outline-rim', C.line2],
    ['text-primary', C.fg], ['text-secondary', C.fg2], ['text-disabled', C.fg3], ['icon-inactive', C.fg2], ['icon-disabled', C.fg3],
    ['call-to-action', '#fff'], ['call-to-action-hover', C.cream], ['overlay-call-to-action', '#fff'], ['suggested-action', 'rgba(255,255,255,.08)'],
    ['inverted-background', C.cream], ['inverted-background-hover', '#fff'], ['mono-filled-hover', '#fff'], ['text-primary-inverse', C.ink],
    ['tonal-background', 'rgba(255,255,255,.04)'], ['mono-tonal-hover', 'rgba(255,255,255,.09)'], ['button-chip-background-hover', 'rgba(255,255,255,.09)'],
    ['frosted-glass-desktop', 'rgba(11,11,12,.82)'], ['touch-response', '#fff'], ['shadow-medium', 'rgba(0,0,0,.6)'],
  ];
  const legacy = [
    ['base-background', 'transparent'], ['raised-background', C.raise], ['menu-background', C.menu], ['general-background-a', 'transparent'],
    ['general-background-b', 'transparent'], ['general-background-c', C.panel], ['brand-background-solid', C.bg], ['brand-background-primary', 'rgba(11,11,12,.9)'],
    ['brand-background-secondary', 'rgba(11,11,12,.8)'], ['text-primary', C.fg], ['text-secondary', C.fg2], ['text-disabled', C.fg3], ['icon-inactive', C.fg2],
    ['10-percent-layer', C.line2], ['badge-chip-background', 'rgba(255,255,255,.05)'], ['additive-background', 'rgba(255,255,255,.05)'], ['outline', C.line2],
    ['call-to-action', '#fff'], ['touch-response', '#fff'], ['mono-filled', C.cream], ['mono-tonal', 'rgba(255,255,255,.04)'],
  ];
  const vars = colors.map(([k, v]) => sys(k, v)).join('') + legacy.map(([k, v]) => spec(k, v)).join('');
  const label = `font:500 10px/1.2 ${YTS_MONO}!important;letter-spacing:.22em!important;text-transform:uppercase!important;color:${C.fg3}!important`;
  const hair = `linear-gradient(${C.line},${C.line}) no-repeat`;
  // (1.9.7) a see-through System24 box: the top border is drawn in two pieces with a gap where the label sits (the label
  // used to cover the line with a black patch, which needed a solid black box), so the box itself can let the ambient
  // light and the stars through; a light dark tint keeps the text readable over a bright glow
  const seeBox = (gap) => `border-top-color:transparent!important;background:linear-gradient(${C.line2},${C.line2}) left top/10px 1px no-repeat border-box,linear-gradient(${C.line2},${C.line2}) right top/calc(100% - ${10 + gap}px) 1px no-repeat border-box,rgba(11,11,12,.3)!important`;
  return `
html,html[dark],html[light],[dark],[light],html[darker-dark-theme],ytd-app,ytd-app *{${vars}color-scheme:dark}
:root{--oto-yts:1}
html{${YTS_STARS}}
body,ytd-app{background:transparent!important}
/* (1.9.7) shooting stars passing by now and then, like Oto for Android's sky: two streaks on their own slow cycles (13 s
   and 19 s, so the pattern takes minutes to repeat), one from the left and one from the right, each crossing for about
   a second. They sit between the stars and the page, move without repainting the page, and stay still for "reduce motion". */
html::before,html::after{content:"";position:fixed;top:0;left:0;width:150px;height:1.5px;border-radius:1px;z-index:-1;pointer-events:none;opacity:0;will-change:transform,opacity;background:linear-gradient(90deg,rgba(255,248,236,0),rgba(255,248,236,.9))}
html::before{animation:yts-meteor-a 13s linear 3s infinite}
html::after{background:linear-gradient(270deg,rgba(255,248,236,0),rgba(255,248,236,.9));animation:yts-meteor-b 19s linear 9s infinite}
@keyframes yts-meteor-a{0%{opacity:0;transform:translate(14vw,10vh) rotate(20deg)}1%{opacity:1}7%{opacity:.9}9%{opacity:0;transform:translate(46vw,28vh) rotate(20deg)}100%{opacity:0;transform:translate(46vw,28vh) rotate(20deg)}}
@keyframes yts-meteor-b{0%{opacity:0;transform:translate(82vw,6vh) rotate(-22deg)}1%{opacity:1}5%{opacity:.9}6.5%{opacity:0;transform:translate(52vw,22vh) rotate(-22deg)}100%{opacity:0;transform:translate(52vw,22vh) rotate(-22deg)}}
@media (prefers-reduced-motion:reduce){html::before,html::after{animation:none!important;display:none!important}}
body{color:${C.fg}}
::selection{background:${C.cream};color:${C.ink}}
::-webkit-scrollbar{width:8px!important;height:8px!important;background:transparent!important}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1)!important;border-radius:0!important;border:0!important}
/* (1.9.5) YouTube's light theme (Linux tells sites "light" unless the desktop is dark): its frosted layer behind the top bar
   and chips, the guide's icons, video titles and the playlist panel had their own light colours */
#frosted-glass,ytd-app #frosted-glass.ytd-app{background:rgba(11,11,12,.86)!important;backdrop-filter:blur(14px)!important}
ytd-app :is(yt-icon,.yt-icon-shape,.ytIconWrapperHost,.yt-spec-icon-shape):not(.ytp-button *){color:${C.fg}!important}
:is(.ytLockupMetadataViewModelTitle,.yt-lockup-metadata-view-model__title,#video-title,.shortsLockupViewModelHostMetadataTitle,.shortsLockupViewModelHostOutsideMetadataTitle,ytm-shorts-lockup-view-model h3) :is(span,a),:is(.ytLockupMetadataViewModelTitle,#video-title,.shortsLockupViewModelHostMetadataTitle,.shortsLockupViewModelHostOutsideMetadataTitle){color:${C.fg}!important}
ytd-app{color:${C.fg}}
/* …except on the cream filled buttons (Subscribe, Sign in) */
ytd-app :is(.ytSpecButtonShapeNextFilled,.yt-spec-button-shape-next--filled) :is(yt-icon,.yt-icon-shape,.ytIconWrapperHost,#yts-never){color:${C.ink}!important}
/* the top bar: frosted black with a hairline, like the sidebar's edge */
#masthead-container #background,ytd-masthead #background{background:rgba(11,11,12,.82)!important;backdrop-filter:blur(14px)}
#masthead-container{box-shadow:inset 0 -1px 0 ${C.line}!important}
ytd-masthead{background:transparent!important}
/* the search box, like Oto's address box: hairline, square-ish corners, serif text */
:is(.ytSearchboxComponentInputBox,ytd-searchbox #container){background:rgba(255,255,255,.03)!important;border:1px solid ${C.line2}!important;border-right:0!important;border-radius:8px 0 0 8px!important;box-shadow:none!important}
:is(.ytSearchboxComponentInput,ytd-searchbox input#search){font:400 18px/1.2 ${YTS_SERIF}!important;color:${C.fg}!important;letter-spacing:.01em}
:is(.ytSearchboxComponentInput,ytd-searchbox input#search)::placeholder{color:${C.fg3}!important}
:is(.ytSearchboxComponentSearchButton,#search-icon-legacy){background:rgba(255,255,255,.06)!important;border:1px solid ${C.line2}!important;border-radius:0 8px 8px 0!important}
:is(.ytSearchboxComponentInputBoxHasFocus,ytd-searchbox[has-focus] #container){border-color:rgba(255,255,255,.32)!important}
.ytSearchboxComponentSuggestionsContainer,.sbdd_b{background:${C.menu}!important;border:1px solid ${C.line2}!important;border-radius:8px!important}
/* (1.9.5) The lists as System24 boxes: YouTube's sidebar, the playlist panel and "Up next" are square boxes with a thin
   border and their label sitting in the top border (like a terminal window), mono text, numbered rows, and the item
   you're on shown inverted. */
#guide-content,tp-yt-app-drawer #contentContainer,ytd-mini-guide-renderer{background:${C.bg}!important}
#guide-content{box-shadow:inset -1px 0 0 ${C.line}!important}
ytd-guide-renderer #sections{counter-reset:yts-sec;padding-top:6px!important}
ytd-guide-section-renderer{display:block!important;position:relative!important;border:1px solid ${C.line2}!important;border-radius:0!important;margin:18px 10px 6px 8px!important;padding:12px 2px 6px!important;counter-increment:yts-sec}
ytd-guide-section-renderer #guide-section-title,ytd-guide-section-renderer:not(:has(#guide-section-title:not(:empty)))::before{position:absolute!important;top:-0.72em!important;left:10px!important;margin:0!important;padding:0 6px!important;background:${C.bg}!important;font:500 10px/1.3 ${YTS_MONO}!important;letter-spacing:.16em!important;text-transform:lowercase!important;color:${C.fg2}!important;display:block!important;z-index:1}
ytd-guide-section-renderer #guide-section-title::before{content:counter(yts-sec,decimal-leading-zero) "\\00a0//\\00a0";color:${C.fg3}}
ytd-guide-section-renderer:not(:has(#guide-section-title:not(:empty)))::before{content:counter(yts-sec,decimal-leading-zero) "\\00a0//\\00a0menu"}
ytd-guide-section-renderer #items{counter-reset:yts-it}
ytd-guide-entry-renderer,ytd-guide-collapsible-section-entry-renderer #header-entry{counter-increment:yts-it}
ytd-guide-entry-renderer tp-yt-paper-item{border-radius:0!important;min-height:30px!important;height:30px!important;padding:0 8px!important}
ytd-guide-entry-renderer tp-yt-paper-item::before{content:counter(yts-it,decimal-leading-zero);font:500 9.5px ${YTS_MONO};color:${C.fg3};width:18px;flex:none;letter-spacing:.04em;margin-right:4px}
ytd-guide-entry-renderer :is(.title,yt-formatted-string.title),ytd-guide-collapsible-section-entry-renderer #header-entry .title{font:400 12.5px/1.2 ${YTS_MONO}!important;color:${C.fg}!important;letter-spacing:.01em!important;text-transform:lowercase}
ytd-guide-entry-renderer :is(yt-icon,yt-img-shadow){opacity:.8;transform:scale(.86);margin-right:10px!important}
ytd-guide-entry-renderer tp-yt-paper-item{gap:8px!important}
ytd-guide-entry-renderer :is(.title,yt-formatted-string.title){white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
ytd-guide-entry-renderer:hover tp-yt-paper-item{background:rgba(255,255,255,.07)!important}
ytd-guide-entry-renderer[active] tp-yt-paper-item{background:${C.fg}!important;box-shadow:none!important}
ytd-guide-entry-renderer[active] :is(.title,yt-icon,yt-icon *,#yts-never),ytd-guide-entry-renderer[active] tp-yt-paper-item::before{color:${C.ink}!important;opacity:1}
/* the playlist / Mix panel */
/* (1.9.6) YouTube hides the panel when there's no playlist and scrolls its list inside it: neither is overridden any
   more (1.9.5 forced it shown, an empty "NaN / NaN" box, and let the list spill out over "Up next"). Its label sits
   on the header's first line instead of in the top border, so nothing has to stick out of the box. */
ytd-playlist-panel-renderer#playlist:not([hidden]){margin-top:14px!important;border:1px solid ${C.line2}!important;border-radius:0!important;background:${C.bg}!important}
ytd-playlist-panel-renderer#playlist[hidden]{display:none!important}
ytd-playlist-panel-renderer .header::before{content:"playlist";display:inline-block;margin:0 0 6px;padding:1px 6px;background:${C.fg2};color:${C.ink};font:500 10px/1.3 ${YTS_MONO};letter-spacing:.16em}
ytd-playlist-panel-renderer :is(#items,.playlist-items,#playlist-items){background:${C.bg}!important}
ytd-playlist-panel-video-renderer:not([selected]):not(:hover){background:transparent!important}
ytd-playlist-panel-renderer #container,ytd-playlist-panel-renderer .header,ytd-playlist-panel-renderer #header-contents{background:${C.bg}!important;border:0!important;border-radius:0!important;box-shadow:none!important}
ytd-playlist-panel-renderer .header{border-bottom:1px dashed ${C.line2}!important}
ytd-playlist-panel-renderer .header :is(.title,h3,yt-formatted-string,a){font:500 13px/1.3 ${YTS_MONO}!important;color:${C.fg}!important;letter-spacing:.01em!important}
ytd-playlist-panel-renderer .header :is(#publisher-container,.byline,.publisher) :is(span,a,yt-formatted-string),ytd-playlist-panel-renderer .header .index-message{font:400 11px/1.4 ${YTS_MONO}!important;color:${C.fg3}!important}
ytd-playlist-panel-video-renderer{border-radius:0!important;padding:4px 6px 4px 0!important}
ytd-playlist-panel-video-renderer:hover{background:rgba(255,255,255,.06)!important}
ytd-playlist-panel-video-renderer #video-title,ytd-playlist-panel-video-renderer #video-title *{font:400 12px/1.35 ${YTS_MONO}!important;color:${C.fg}!important}
ytd-playlist-panel-video-renderer :is(#byline,#channel-name,ytd-channel-name) :is(a,span,yt-formatted-string){font:400 10.5px/1.3 ${YTS_MONO}!important;color:${C.fg3}!important}
ytd-playlist-panel-video-renderer #index{font:500 10px ${YTS_MONO}!important;color:${C.fg3}!important}
ytd-playlist-panel-video-renderer :is(ytd-thumbnail,#thumbnail,img){border-radius:0!important}
ytd-playlist-panel-video-renderer[selected]{background:${C.fg}!important}
ytd-playlist-panel-video-renderer[selected] :is(#video-title,#video-title *,#byline *,#channel-name *,#index,yt-icon,#yts-never),ytd-playlist-panel-video-renderer[selected] :is(*,#yts-never#yts-n2):not(ytd-thumbnail *):not(ytd-thumbnail){color:${C.ink}!important}
/* (1.9.5) under the video, the same way: the channel row's buttons square, the description and the comments as boxes with
   their label in the top border, mono names and times, dashed lines between comments, straight reply lines */
ytd-watch-metadata :is(.ytSpecButtonShapeNextHost,.yt-spec-button-shape-next,.ytSegmentedLikeDislikeButtonViewModelSegmentedButtonsWrapper,segmented-like-dislike-button-view-model *,#subscribe-button *,yt-touch-feedback-shape,.ytSpecTouchFeedbackShapeStroke,.ytSpecTouchFeedbackShapeFill){border-radius:0!important}
ytd-watch-metadata #owner :is(.ytSpecButtonShapeNextHost,.yt-spec-button-shape-next),ytd-watch-metadata #actions :is(.ytSpecButtonShapeNextHost,.yt-spec-button-shape-next){font-family:${YTS_MONO}!important;font-size:12px!important;letter-spacing:.02em!important}
ytd-watch-metadata :is(#description,#description.ytd-watch-metadata){position:relative!important;overflow:visible!important;border:1px solid ${C.line2}!important;border-radius:0!important;box-shadow:none!important;${seeBox(52)};margin-top:20px!important}
ytd-watch-metadata #description::before{content:"about";position:absolute;top:-0.72em;left:10px;padding:0 6px;background:transparent;font:500 10px/1.3 ${YTS_MONO};letter-spacing:.16em;color:${C.fg2};z-index:2}
ytd-watch-metadata #description :is(ytd-text-inline-expander,#description-inner,#snippet){background:transparent!important;border-radius:0!important;box-shadow:none!important}
ytd-comments#comments{display:block!important;position:relative!important;border:1px solid ${C.line2}!important;padding:18px 16px 8px!important;margin-top:26px!important;${seeBox(76)}}
ytd-comments#comments::before{content:"comments";position:absolute;top:-0.72em;left:10px;padding:0 6px;background:transparent;font:500 10px/1.3 ${YTS_MONO};letter-spacing:.16em;color:${C.fg2};z-index:2}
ytd-comments#comments :is(.ytSpecButtonShapeNextHost,.yt-spec-button-shape-next,yt-touch-feedback-shape,tp-yt-paper-button,#sort-menu *){border-radius:0!important}
ytd-comments-header-renderer #placeholder-area,ytd-comment-simplebox-renderer #placeholder-area{font-family:${YTS_MONO}!important;font-size:12.5px!important;color:${C.fg3}!important;border-bottom:1px dashed ${C.line2}!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model) :is(#author-text,#author-text span,.ytCommentViewModelAuthorText){font:500 12px/1.3 ${YTS_MONO}!important;color:${C.fg}!important;text-decoration:none!important;letter-spacing:.01em!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model) :is(#published-time-text,#published-time-text a,.published-time-text a){font:400 11px/1.3 ${YTS_MONO}!important;color:${C.fg3}!important;text-decoration:none!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model) :is(#translate-button,#translate-button *,#vote-count-middle,#vote-count-left,.ytCommentViewModelTranslate){font-family:${YTS_MONO}!important;font-size:11.5px!important;color:${C.fg2}!important;letter-spacing:.02em!important}
ytd-comment-thread-renderer{border-bottom:1px dashed ${C.line}!important;padding:10px 0 8px!important;margin:0!important}
ytd-comment-thread-renderer:last-of-type{border-bottom:0!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model,ytd-comment-replies-renderer) :is([class*="hreadline"],[class*="hreadLine"],[class*="Connector"],[id*="threadline"],.thread-line){border-radius:0!important;border-color:${C.line2}!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model,ytd-watch-metadata #owner) :is(#author-thumbnail img,yt-img-shadow,yt-img-shadow img,#avatar img,.ytCoreImageHost){border-radius:2px!important}
:is(ytd-comment-thread-renderer,ytd-comment-view-model) #content-text :is(span,a){font-size:13.5px!important;line-height:1.5!important}
/* the chat replay box on the right (Open panel) */
#chat-container :is(ytd-live-chat-frame,#show-hide-button),ytd-live-chat-frame#chat{border-radius:0!important;border:1px solid ${C.line2}!important;background:${C.bg}!important}
/* "Up next" beside a video */
#secondary #related{position:relative!important;border:1px solid ${C.line2}!important;padding:16px 8px 6px!important;margin-top:14px!important;${seeBox(68)}}
#secondary #related::before{content:"up next";position:absolute;top:-0.72em;left:10px;padding:0 6px;background:transparent;font:500 10px/1.3 ${YTS_MONO};letter-spacing:.16em;color:${C.fg2};z-index:2}
#secondary #related :is(.ytLockupMetadataViewModelTitle,#video-title) :is(span,yt-formatted-string),#secondary #related :is(.ytLockupMetadataViewModelTitle,#video-title){font:400 12.5px/1.35 ${YTS_MONO}!important;letter-spacing:.005em!important}
#secondary #related :is(yt-lockup-view-model,ytd-compact-video-renderer){border-radius:0!important}
#secondary #related :is(ytd-thumbnail,.ytThumbnailViewModelImage,img,.ytCoreImageHost){border-radius:0!important}
ytd-guide-signin-promo-renderer,#footer.ytd-guide-renderer{${label};text-transform:none!important;letter-spacing:.02em!important;line-height:1.6!important}
ytd-mini-guide-entry-renderer .title{font:500 8.5px/1.3 ${YTS_MONO}!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:${C.fg2}!important}
ytd-mini-guide-entry-renderer[active] .title{color:#fff!important}
ytd-mini-guide-entry-renderer[active]{background:linear-gradient(rgba(255,255,255,.1),rgba(255,255,255,.02))!important;border-radius:6px!important}
/* (1.9.6) text that stayed dark on YouTube's light theme: the description, the channel name and the buttons beside it,
   the details under videos in "Up next", and the channel page's tabs bar (white) */
ytd-watch-metadata #description :is(span,yt-formatted-string,h2,h3,div,#title):not(a):not(a *):not(span[style*="border-radius"] *){color:${C.fg}!important}
ytd-watch-metadata :is(#owner,#actions) :is(.ytSpecButtonShapeNextTonal,.yt-spec-button-shape-next--tonal,.ytSpecButtonShapeNextText,.yt-spec-button-shape-next--text){color:${C.fg}!important}
ytd-watch-metadata #owner ytd-channel-name :is(a,yt-formatted-string){color:${C.fg}!important}
:is(.ytContentMetadataViewModelMetadataText,.yt-content-metadata-view-model__metadata-text){color:${C.fg3}!important}
:is(.ytContentMetadataViewModelMetadataRow,.yt-content-metadata-view-model__metadata-row):first-child :is(.ytContentMetadataViewModelMetadataText,.yt-content-metadata-view-model__metadata-text){color:${C.fg2}!important}
:is(#tabs-inner-container,#tabs-container,tp-yt-app-toolbar,yt-tab-group-shape,.ytTabGroupShapeHost,.yt-tab-group-shape-wiz){background:rgba(11,11,12,.86)!important}
:is(yt-tab-shape,.ytTabShapeHost,.yt-tab-shape-wiz) :is(.ytTabShapeTab,.yt-tab-shape-wiz__tab),yt-tab-shape{font:500 11px/1 ${YTS_MONO}!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:${C.fg2}!important}
:is(.ytTabShapeTabSelected,.yt-tab-shape-wiz__tab--tab-selected),yt-tab-shape[aria-selected="true"] :is(.ytTabShapeTab,.yt-tab-shape-wiz__tab){color:${C.fg}!important}
:is(.ytTabGroupShapeSliderHighlight,.yt-tab-group-shape-wiz__slider){background:${C.fg}!important}
/* the topic chips: hairline boxes with mono caps; the picked one in cream, like the active tab */
/* (1.9.6) the blur is on the chip row itself: on the grid's header around it, it made the row move with the page and
   the first videos covered it */
#chips-wrapper,ytd-feed-filter-chip-bar-renderer #chips-wrapper{background:rgba(11,11,12,.86)!important;backdrop-filter:blur(10px)}
#header.ytd-rich-grid-renderer{background:transparent!important;backdrop-filter:none!important}
:is(yt-chip-cloud-chip-renderer,.ytChipShapeChip){background:transparent!important;box-shadow:inset 0 0 0 1px ${C.line2}!important;border-radius:4px!important}
:is(yt-chip-cloud-chip-renderer,.ytChipShapeChip) :is(#text,yt-formatted-string,.ytChipShapeChipText),.ytChipShapeChip{font:500 10.5px/1 ${YTS_MONO}!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:${C.fg2}!important}
:is(yt-chip-cloud-chip-renderer:hover,.ytChipShapeChip:hover){background:rgba(255,255,255,.05)!important}
:is(yt-chip-cloud-chip-renderer[selected],.ytChipShapeActive){background:${C.cream}!important;box-shadow:none!important}
:is(yt-chip-cloud-chip-renderer[selected],.ytChipShapeActive) :is(#text,yt-formatted-string,.ytChipShapeChipText),.ytChipShapeActive{color:${C.ink}!important}
/* videos: softer corners, serif titles, mono details */
:is(ytd-thumbnail,yt-thumbnail-view-model,.yt-thumbnail-view-model,a.yt-lockup-view-model__content-image,a.ytLockupViewModelContentImage,ytd-playlist-thumbnail) :is(img,yt-image,.yt-core-image,.ytCoreImageHost),
:is(ytd-thumbnail,.ytThumbnailViewModelImage,yt-thumbnail-view-model,ytd-playlist-thumbnail),#thumbnail.ytd-thumbnail{border-radius:6px!important}
:is(ytd-thumbnail:hover,a.yt-lockup-view-model__content-image:hover,a.ytLockupViewModelContentImage:hover) :is(img,.yt-core-image,.ytCoreImageHost){box-shadow:0 0 0 1px rgba(255,255,255,.35)}
:is(#video-title,.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle,h3.yt-lockup-metadata-view-model__heading-reset,h3.ytLockupMetadataViewModelHeadingReset) :is(span,yt-formatted-string),#video-title,.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle{font-family:${YTS_SERIF}!important;font-weight:400!important;letter-spacing:.005em!important}
ytd-rich-item-renderer :is(#video-title,.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle) :is(span,yt-formatted-string),ytd-rich-item-renderer :is(#video-title,.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle){font-size:19px!important;line-height:1.18!important}
ytd-video-renderer #video-title,ytd-video-renderer #video-title yt-formatted-string{font-size:22px!important;line-height:1.2!important}
ytd-compact-video-renderer #video-title,#secondary yt-lockup-view-model :is(.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle) :is(span,yt-formatted-string){font-size:16.5px!important;line-height:1.2!important}
:is(#metadata-line,ytd-video-meta-block #metadata,.yt-content-metadata-view-model__metadata-row,.ytContentMetadataViewModelMetadataRow) :is(span,a){font-family:${YTS_MONO}!important;font-size:11px!important;letter-spacing:.02em!important;color:${C.fg3}!important}
:is(ytd-channel-name,#channel-name) :is(a,yt-formatted-string),:is(.yt-content-metadata-view-model__metadata-row,.ytContentMetadataViewModelMetadataRow):first-child :is(span,a){color:${C.fg2}!important}
:is(ytd-thumbnail-overlay-time-status-renderer,.yt-badge-shape--thumbnail-default,.ytBadgeShapeThumbnailDefault){background:rgba(11,11,12,.82)!important;color:${C.fg}!important;font-family:${YTS_MONO}!important;letter-spacing:.04em!important;border-radius:3px!important;box-shadow:inset 0 0 0 1px ${C.line2}}
ytd-thumbnail-overlay-resume-playback-renderer #progress,.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment{background:#fff!important}
/* links in descriptions and comments: white with a faint underline instead of blue */
:is(ytd-text-inline-expander,#description,ytd-comment-view-model,#content-text,yt-attributed-string) a:not([class*="ytSpecButton"]):not([class*="yt-spec-button"]):not(span[style*="border-radius"] a):not(#author-text):not(#published-time-text a):not(.published-time-text a){color:#fff!important;text-decoration:underline!important;text-decoration-color:rgba(255,255,255,.3)!important;text-underline-offset:2px}
/* the little link boxes YouTube draws in descriptions and comments (a channel or video with the YouTube icon, a search
   with a magnifier): a hairline box with room inside and no underline (1.9.3: the text touched the edges and the
   underline hung out below the box) */
:is(ytd-text-inline-expander,#description,ytd-comment-view-model,#content-text,yt-attributed-string,.ytAttributedStringHost) span[style*="border-radius"]{background:rgba(255,255,255,.06)!important;box-shadow:inset 0 0 0 1px ${C.line2}!important;padding:1px 6px 2px!important;border-radius:5px!important;-webkit-box-decoration-break:clone;box-decoration-break:clone}
:is(ytd-text-inline-expander,#description,ytd-comment-view-model,#content-text,yt-attributed-string,.ytAttributedStringHost) span[style*="border-radius"] a{text-decoration:none!important;color:#fff!important}
/* shelf and section headings: mono caps with a hairline, like "JUMP BACK IN · LAST SIGNALS" */
:is(ytd-rich-shelf-renderer,ytd-reel-shelf-renderer,ytd-shelf-renderer,ytd-horizontal-card-list-renderer,ytd-item-section-header-renderer) #title:not(:empty),
ytd-rich-section-renderer #title-text,yt-section-header-view-model .yt-shelf-header-layout__title,.ytShelfHeaderLayoutTitle{${label};font-size:11px!important}
/* the watch page: a big serif title, hairline boxes, the cream Subscribe */
ytd-watch-metadata h1 yt-formatted-string,ytd-watch-metadata #title h1{font:400 34px/1.1 ${YTS_SERIF}!important;letter-spacing:.005em!important;color:${C.fg}!important}
ytd-watch-metadata #info-container,ytd-watch-info-text #info span{font-family:${YTS_MONO}!important;font-size:12px!important;letter-spacing:.02em}
:is(ytd-comments-header-renderer h2,ytd-comments-header-renderer #count) yt-formatted-string,ytd-comments-header-renderer #count{${label};font-size:11px!important}
ytd-comment-view-model #author-text,ytd-comment-renderer #author-text{font-family:${YTS_MONO}!important;font-size:12px!important;letter-spacing:.02em}
/* buttons: hairline pills; the filled one (Subscribe, Sign in) in cream; blue "Sign in" outlines in white
   (YouTube writes these classes both ways: yt-spec-button-shape-next--tonal and ytSpecButtonShapeNextTonal) */
:is(.yt-spec-button-shape-next--tonal.yt-spec-button-shape-next--mono,.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextMono){background:rgba(255,255,255,.03)!important;box-shadow:inset 0 0 0 1px ${C.line2}!important}
:is(.yt-spec-button-shape-next--tonal.yt-spec-button-shape-next--mono,.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextMono):hover{background:rgba(255,255,255,.08)!important}
:is(.yt-spec-button-shape-next--filled.yt-spec-button-shape-next--mono,.ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono){background:${C.cream}!important;color:${C.ink}!important}
:is(.yt-spec-button-shape-next--filled.yt-spec-button-shape-next--mono,.ytSpecButtonShapeNextFilled.ytSpecButtonShapeNextMono):hover{background:#fff!important}
:is(.yt-spec-button-shape-next--outline,.ytSpecButtonShapeNextOutline){border-color:${C.line2}!important}
:is(.yt-spec-button-shape-next--call-to-action,.ytSpecButtonShapeNextCallToAction):is(.yt-spec-button-shape-next--outline,.ytSpecButtonShapeNextOutline){color:#fff!important;border-color:rgba(255,255,255,.3)!important}
:is(.yt-spec-button-shape-next--call-to-action,.ytSpecButtonShapeNextCallToAction):is(.yt-spec-button-shape-next--outline,.ytSpecButtonShapeNextOutline) *{color:#fff!important}
/* ---------- Oto's layout, not YouTube's ---------- */
/* the logo: Oto's space badge ("音  TUBE · OTO // YOUTUBE", like the sidebar's "HOME · OTO // SPACE") */
ytd-topbar-logo-renderer a#logo>div>*,ytd-topbar-logo-renderer #country-code,ytd-topbar-logo-renderer ytd-yoodle-renderer{display:none!important}
ytd-topbar-logo-renderer a#logo{display:flex!important;align-items:center;gap:10px;height:38px;box-sizing:border-box;padding:0 14px 0 11px!important;border:1px solid ${C.line2};border-radius:6px;background:rgba(255,255,255,.015);text-decoration:none!important}
ytd-topbar-logo-renderer a#logo:hover{background:rgba(255,255,255,.05)}
ytd-topbar-logo-renderer a#logo::before{content:"音";font:400 17px/1 "Yu Gothic UI","Meiryo","Noto Sans CJK JP",sans-serif;color:${C.fg}}
ytd-topbar-logo-renderer a#logo>div{display:flex!important;flex-direction:column;gap:4px;width:auto!important;height:auto!important}
ytd-topbar-logo-renderer a#logo>div::before{content:"TUBE";font:700 12px/1 Inter,"Segoe UI",system-ui,sans-serif;letter-spacing:.24em;color:${C.fg}}
ytd-topbar-logo-renderer a#logo>div::after{content:"OTO // YOUTUBE";font:500 8.5px/1 ${YTS_MONO};letter-spacing:.2em;color:${C.fg3}}
/* the search box, like the start page's: one rounded box with a star, serif text and a key hint */
:is(.ytSearchboxComponentInputBox,ytd-searchbox #container){position:relative!important;border-radius:10px 0 0 10px!important;padding-left:38px!important;background:rgba(255,255,255,.025)!important}
:is(.ytSearchboxComponentInputBox,ytd-searchbox #container)::before{content:"✦";position:absolute;left:15px;top:50%;transform:translateY(-50%);font-size:14px;color:${C.fg};pointer-events:none}
/* YouTube puts its own magnifier inside the box when it's clicked; the star already marks it (1.9.3: they sat on top of the text) */
.ytSearchboxComponentInnerSearchIcon,ytd-searchbox #search-icon.ytd-searchbox{display:none!important}
:is(.ytSearchboxComponentSearchButton,#search-icon-legacy){border-radius:0 10px 10px 0!important;background:rgba(255,255,255,.025)!important;border-left:1px solid ${C.line}!important;width:56px!important}
:is(.ytSearchboxComponentSearchButton,#search-icon-legacy) :is(yt-icon,svg,.ytIconWrapperHost){color:${C.fg2}!important;fill:${C.fg2}!important}
yt-searchbox:not(:focus-within) .ytSearchboxComponentInputBox::after{content:"/";position:absolute;right:10px;top:50%;transform:translateY(-50%);font:500 10px/1 ${YTS_MONO};color:${C.fg2};padding:4px 7px;border:1px solid ${C.line2};border-radius:4px;pointer-events:none}
/* search results: numbered hairline cards, like "Jump back in" on the start page */
ytd-search ytd-item-section-renderer #contents{counter-reset:yts-r}
ytd-search ytd-video-renderer{counter-increment:yts-r;margin-top:12px!important}
ytd-search ytd-video-renderer #dismissible{background:rgba(255,255,255,.02)!important;box-shadow:inset 0 0 0 1px ${C.line}!important;border-radius:10px!important;padding:12px!important;transition:background .15s,box-shadow .15s}
ytd-search ytd-video-renderer #dismissible:hover{background:rgba(255,255,255,.045)!important;box-shadow:inset 0 0 0 1px ${C.line2}!important}
ytd-search ytd-video-renderer ytd-thumbnail.ytd-video-renderer{max-width:340px!important}
ytd-search ytd-video-renderer .text-wrapper{padding-left:8px!important}
ytd-search ytd-video-renderer #meta::before{content:counter(yts-r,decimal-leading-zero) "\\00a0\\00a0//\\00a0\\00a0VIDEO";display:block;${label};font-size:9.5px!important;margin:2px 0 10px;padding-right:8px;background:${hair} right center/calc(100% - 150px) 1px}
ytd-search ytd-video-renderer:has(:is(.badge-style-type-live-now-alternate,.ytBadgeShapeLive)) #meta::before{content:counter(yts-r,decimal-leading-zero) "\\00a0\\00a0//\\00a0\\00a0ON AIR"}
ytd-search ytd-video-renderer :is(#description-text,.metadata-snippet-text,.metadata-snippet-container) :is(span,yt-formatted-string),ytd-search ytd-video-renderer #description-text{color:${C.fg3}!important;font-size:12.5px!important}
ytd-search ytd-video-renderer #channel-info ytd-channel-name :is(a,yt-formatted-string){font:500 11px/1.4 ${YTS_MONO}!important;letter-spacing:.06em!important;text-transform:uppercase;color:${C.fg2}!important}
ytd-search ytd-video-renderer #expandable-metadata :is(#header,ytd-expandable-metadata-renderer){background:transparent!important;box-shadow:inset 0 0 0 1px ${C.line}!important;border-radius:6px!important}
:is(.badge-style-type-live-now-alternate,.badge-style-type-live-now,.ytBadgeShapeLive,.yt-badge-shape--live){background:transparent!important;color:#fff!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)!important;border-radius:3px!important;font-family:${YTS_MONO}!important;letter-spacing:.12em!important}
:is(ytd-badge-supported-renderer .badge,.ytBadgeShapeHost:not(.ytBadgeShapeThumbnailDefault)){border-radius:3px!important;font-family:${YTS_MONO}!important;letter-spacing:.06em!important}
/* the channel / artist card on top of results: a plain hairline panel, no YouTube banner glow */
yt-official-card-view-model,ytd-universal-watch-card-renderer{display:block;background:rgba(255,255,255,.02)!important;box-shadow:inset 0 0 0 1px ${C.line}!important;border-radius:10px!important;overflow:hidden;margin-top:12px!important}
yt-official-card-view-model :is(.ytCinematicContainerViewModelFadeToThemeContainer,.ytPageHeaderViewModelBackground){display:none!important}
yt-official-card-view-model :is(.ytOfficialCardViewModelHostCinematicContentContainer,.ytwHorizontalShelfViewModelOuterContainer,yt-page-header-view-model){background:transparent!important}
yt-official-card-view-model::before{content:"ON\\00a0\\00a0//\\00a0\\00a0CHANNEL";display:block;${label};font-size:9.5px!important;padding:14px 16px 0;background:${hair} right 16px bottom 5px/calc(100% - 190px) 1px}
.ytPageHeaderViewModelTitle :is(span,.ytAttributedStringHost),.ytPageHeaderViewModelTitle{font:400 40px/1.05 ${YTS_SERIF}!important;letter-spacing:.005em!important;color:${C.fg}!important}
.ytPageHeaderViewModelContentMetadata :is(span,a){font-family:${YTS_MONO}!important;font-size:11px!important;letter-spacing:.04em!important;color:${C.fg3}!important}
/* grids (home, shelves) and the list beside a video: the same quiet cards */
ytd-rich-item-renderer :is(yt-lockup-view-model,#content>ytd-rich-grid-media),ytd-search grid-shelf-view-model .ytGridShelfViewModelGridShelfItem{background:rgba(255,255,255,.02);box-shadow:inset 0 0 0 1px ${C.line};border-radius:10px;padding:8px 8px 4px;transition:background .15s}
ytd-rich-item-renderer :is(yt-lockup-view-model,#content>ytd-rich-grid-media):hover,ytd-search grid-shelf-view-model .ytGridShelfViewModelGridShelfItem:hover{background:rgba(255,255,255,.045);box-shadow:inset 0 0 0 1px ${C.line2}}
ytd-search grid-shelf-view-model{display:block;margin-top:16px}
#secondary :is(yt-lockup-view-model,ytd-compact-video-renderer){border-radius:8px;padding:4px;transition:background .15s}
#secondary :is(yt-lockup-view-model,ytd-compact-video-renderer):hover{background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px ${C.line}}
/* menus and pop-ups */
tp-yt-paper-listbox,ytd-menu-popup-renderer,ytd-multi-page-menu-renderer,yt-sheet-view-model,.ytSheetViewModelContextual{background:${C.menu}!important;border:1px solid ${C.line2}!important;border-radius:8px!important;box-shadow:0 30px 80px -10px rgba(0,0,0,.75)!important}
tp-yt-paper-dialog,ytd-popup-container tp-yt-paper-dialog{background:${C.panel}!important;border:1px solid ${C.line2}!important}
tp-yt-paper-tooltip #tooltip,.ytp-tooltip-text{background:${C.cream}!important;color:${C.ink}!important;font-family:${YTS_MONO}!important;letter-spacing:.04em;border-radius:3px!important}
/* the player: a white played bar and knob instead of red, like Oto's own media bar */
.ytp-play-progress,.ytp-swatch-background-color,.ytp-load-progress+.ytp-play-progress{background:linear-gradient(90deg,${C.cream},#fff)!important}
.ytp-scrubber-button,.ytp-swatch-background-color.ytp-scrubber-button{background:#fff!important;box-shadow:0 0 10px rgba(255,255,255,.6)!important}
.ytp-volume-slider-handle,.ytp-volume-slider-handle::before{background:#fff!important}
.ytp-settings-menu,.ytp-popup{background:rgba(11,11,12,.92)!important;border:1px solid ${C.line2};border-radius:8px!important}
.ytp-chrome-bottom .ytp-time-display{font-family:${YTS_MONO}!important;letter-spacing:.02em}
`;
}

// (1.9.6) The look is built on YouTube's dark theme. On Linux, sites are often told the desktop is light, so YouTube
// draws its light theme, and parts of it (the description, buttons, tabs, the playlist's rows) kept dark text or white
// backgrounds the sheet couldn't reach. While the look is on, the page is switched to YouTube's own dark theme the way
// YouTube does it itself: the "dark" attribute on <html>, kept there if YouTube takes it off. Only this page, in this
// tab: no setting, cookie or account choice changes. Turning the look off puts it back as YouTube had it.
const YTS_DARK_ON = "(()=>{const h=document.documentElement,w=window;if(!w.__otoYtsDark){const d={had:h.hasAttribute('dark'),on:true};d.o=new MutationObserver(()=>{if(d.on&&!h.hasAttribute('dark'))h.setAttribute('dark','')});d.o.observe(h,{attributes:true,attributeFilter:['dark']});w.__otoYtsDark=d}w.__otoYtsDark.on=true;if(!h.hasAttribute('dark'))h.setAttribute('dark','');return getComputedStyle(h).getPropertyValue('--oto-yts').trim()})()";
const YTS_DARK_OFF = "(()=>{const d=window.__otoYtsDark;if(!d)return 0;d.on=false;if(!d.had)document.documentElement.removeAttribute('dark');return 1})()";
// On the moment a page is ready, never waiting for the fonts (they're added when read). Every change to a tab's sheet
// runs one at a time, in order (1.9.2): before, an older, slower run could take out the sheet a newer one had just put
// in, and the page stayed as plain YouTube.
// every call into the page gets a time limit, so one that never answers can't hold up the rest
const ytsTimed = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(`no answer in ${ms} ms`)), ms))]);
function ytsQueue(v, fn) { v.ytsQ = (v.ytsQ || Promise.resolve()).then(fn).catch((e) => { v.ytsErr = String((e && e.message) || e); }); return v.ytsQ; }
async function ytsApplyNow(v) {
  if (!v || !v.wv) return;
  let url = '';
  try { url = v.wv.getURL(); } catch { return; }
  const want = YTS_HOST.test(url) && ytsOn();
  let key = null;
  if (want) {
    v.ytsStage = 'insert';
    const p = v.wv.insertCSS((ytsFontCss || '') + ytsCss());
    try { key = await ytsTimed(p, 4000); } catch (e) { v.ytsErr = String((e && e.message) || e); p.then((late) => { (v.ytsLate = v.ytsLate || []).push(late); }, () => {}); }
  }
  const old = [v.ytsKey, ...(v.ytsLate || [])].filter(Boolean); v.ytsKey = key; v.ytsLate = []; // the new sheet goes in first, then the old ones come out: no flash
  if (YTS_HOST.test(url)) { v.ytsStage = 'dark'; try { await ytsTimed(v.wv.executeJavaScript(want ? YTS_DARK_ON : YTS_DARK_OFF), 2000); } catch (e) { v.ytsErr = String((e && e.message) || e); } }
  v.ytsStage = 'done';
  for (const o of old) { try { await ytsTimed(v.wv.removeInsertedCSS(o), 2000); } catch {} }
  if (want && ytsFontCss === null) ytsFonts().then((f) => { if (f) ytsApply(v); });
}
function ytsApply(v) { return ytsQueue(v, () => ytsApplyNow(v)); }
function ytsCheck(v) {
  return ytsQueue(v, async () => {
    if (!v || !v.wv || !ytsOn()) return;
    let url = '';
    try { url = v.wv.getURL(); } catch { return; }
    if (!YTS_HOST.test(url)) return;
    let mark = '';
    v.ytsStage = 'check'; try { mark = await ytsTimed(v.wv.executeJavaScript(YTS_DARK_ON), 2000); } catch (e) { v.ytsErr = String((e && e.message) || e); }
    if (String(mark) !== '1') { v.ytsKey = null; await ytsApplyNow(v); }
  });
}
function ytsRefresh() { for (const v of V.values()) if (v && v.ready) ytsApply(v); }
// Hooks on each tab's page: on a new page the look goes on; after every page change and finished load the safety net
// looks for the marker. They're attached when a tab's view is made, and also by a sweep once a second, because a view
// made before this file's hook was in place (it happens at start-up, depending on load order: CI caught tabs whose
// page events never reached the look at all) would otherwise never get them.
const ytsHooked = new WeakSet();
function ytsHook(v) {
  if (!v || !v.wv || ytsHooked.has(v.wv)) return false;
  ytsHooked.add(v.wv);
  try {
    v.wv.addEventListener('dom-ready', () => { v.ytsKey = null; ytsApply(v); }); // a new page starts without our sheets
    const later = () => { clearTimeout(v.ytsT1); clearTimeout(v.ytsT2); v.ytsT1 = setTimeout(() => ytsCheck(v), 400); v.ytsT2 = setTimeout(() => ytsCheck(v), 2000); };
    v.wv.addEventListener('did-navigate', later);
    v.wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) later(); });
    v.wv.addEventListener('did-stop-loading', later);
  } catch {}
  return true;
}
let ytsReady = false;
function initYoutubeSpace() {
  if (ytsReady) return;
  ytsReady = true;
  if (typeof bindView === 'function') {
    const _bind = bindView;
    bindView = function (tab, v) { _bind.apply(this, arguments); ytsHook(v); };
  }
  setInterval(() => { if (typeof V === 'undefined') return; for (const v of V.values()) if (ytsHook(v) && v.ready) ytsCheck(v); }, 1000);
  ytsFonts(); // read the font(s) once, early
}
// Always, straight away. (Before 1.9.2 this waited for "S" to exist, but S is only filled in once start-up has read the
// saved state; when that took longer than loading this file, the hooks were never set up and the look only went on
// when Settings changed. That was the "have to put it back by hand" bug.)
initYoutubeSpace();
