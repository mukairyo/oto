# CRX test packages

From Chromium's own test data (`components/test/data/crx_file/`), unchanged. Used only by `test/extensions.test.js`
to check Oto's extension signature check against real packages; never shipped in Oto.

- `valid_publisher.crx3`: signed by its developer key and by the Chrome Web Store key
- `valid_no_publisher.crx3`: developer signature only
- `unsigned.crx3`: no valid developer proof
- `valid.crx2`: old CRX2 format

Copyright 2017 The Chromium Authors. Use of these files is governed by a BSD-style license:
https://chromium.googlesource.com/chromium/src/+/main/LICENSE
