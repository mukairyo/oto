# uBlock Origin Lite rules used by Oto

These files are unchanged copies from **uBlock Origin Lite** by Raymond Hill and contributors
(<https://github.com/uBlockOrigin/uBOL-home>, built from <https://github.com/gorhill/uBlock>), licensed under the
GNU General Public License v3 (see `LICENSE.txt`). Source code: the two repositories above.

Oto uses them in Oto Shield's "uBlock Origin Lite" mode (`main/ubol.js`): the network rules are read by Oto Shield's
engine, the scriptlet files run in web pages as uBOL runs them. Since Oto 1.7.12 this copy is the only one Oto uses: newer
uBOL rules arrive with Oto updates (whose releases are proven, docs/UPDATE_TRUST.md), never downloaded on their own.
`HASHES.json` records every file's SHA-256 and is checked by `test/ubol.test.js`.
Refresh this copy with `node scripts/vendor-ubol.js --commit <uBOL-home commit>`.
