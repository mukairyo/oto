// Oto — tiny preload for web pages (runs before the page's own scripts).
// Google sign-in refuses browsers whose `window.chrome` object is empty, which is how plain Electron looks
// ("This browser or app may not be secure"). On Google's sign-in pages only, fill in the standard Chrome
// properties so signing in works like in Chrome. Nothing else is changed and nothing is read from the page.
'use strict';
try {
  const host = location.hostname;
  if (/(^|\.)accounts\.google\.com$/.test(host) || /(^|\.)accounts\.youtube\.com$/.test(host)) {
    const { contextBridge, webFrame } = require('electron');
    const fill = () => {
      const c = window.chrome || {};
      if (!c.app) {
        c.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails() { return null; }, getIsInstalled() { return false; }, runningState() { return 'cannot_run'; },
        };
      }
      if (!c.runtime) {
        c.runtime = {
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
          connect() { throw new TypeError('Error in invocation of runtime.connect'); },
          sendMessage() { throw new TypeError('Error in invocation of runtime.sendMessage'); },
          id: undefined,
        };
      }
      if (!c.csi) {
        c.csi = function csi() { const t = performance.timing; return { onloadT: t.domContentLoadedEventEnd, startE: t.navigationStart, pageT: performance.now(), tran: 15 }; };
      }
      if (!c.loadTimes) {
        c.loadTimes = function loadTimes() {
          const t = performance.timing, s = (v) => v / 1000;
          return { requestTime: s(t.navigationStart), startLoadTime: s(t.navigationStart), commitLoadTime: s(t.responseStart), finishDocumentLoadTime: s(t.domContentLoadedEventEnd), finishLoadTime: s(t.loadEventEnd), firstPaintTime: s(t.responseEnd), firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' };
        };
      }
      try { Object.defineProperty(window, 'chrome', { value: c, writable: true, configurable: true, enumerable: true }); } catch { window.chrome = c; }
    };
    if (contextBridge && contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: fill });
    else if (webFrame) webFrame.executeJavaScript(`(${fill.toString()})()`);
  }
} catch {}
