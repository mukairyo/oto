# Shield's scriptlets and redirect stand-ins (bundled)

`resources.json` holds the small scripts Oto Shield runs in pages for filter rules (`##+js(...)` scriptlets) and the
harmless stand-ins it serves for blocked scripts (`redirect=`). They come from uBlock Origin (GPLv3,
https://github.com/gorhill/uBlock), as packaged by Ghostery's adblocker (MPL-2.0).

Pinned to the adblocker version Oto uses:
https://raw.githubusercontent.com/ghostery/adblocker/v2.20.3/packages/adblocker/assets/ublock-origin/resources.json
SHA-256 `5ce0ce483f0e5514308ccb0240960a9dd7bfeab417debeef96960dce2c95f690` (checked by `test/shield-resources.test.js`).

Why bundled (1.7.12): the adblocker library downloads this file from its GitHub `master` branch every time the lists
update, and its code runs in every page. Code that runs in pages now comes only with Oto, whose releases are proven
(docs/UPDATE_TRUST.md). The filter lists themselves still update every day; rules from them can't use uBO's
"trusted" scriptlets (the ones that can put any code into a page).

To update: bump `@ghostery/adblocker`, fetch the file from the matching tag, update the hash here and in the test.
