'use strict';

// Static regression gate. This is NOT a substitute for reviewing rendered
// PDF/DOCX output for all 38 ISO and 45 QD2429 templates on Web v1.58.59.
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const javaScript = [
  'webapp/nah-iso15189-suite/assets/app.js',
  'native/windows/app.js',
  'native/windows/offline/assets/app.js',
  'app/src/main/assets/offline/assets/app.js',
];
const stylesheets = [
  'webapp/nah-iso15189-suite/assets/app.css',
  'native/windows/app.css',
  'native/windows/offline/assets/app.css',
  'app/src/main/assets/offline/assets/app.css',
];

function read(name) { return fs.readFileSync(name, 'utf8'); }
function requires(text, phrase, message) { assert(text.includes(phrase), message || phrase); }

for (const p of javaScript) {
  cp.execFileSync(process.execPath, ['--check', p], {stdio:'pipe'});
  assert.equal(read(p), read(javaScript[0]), 'JS mirror mismatch: ' + p);
}
for (const p of stylesheets) {
  assert.equal(read(p), read(stylesheets[0]), 'CSS mirror mismatch: ' + p);
}
const js = read(javaScript[0]);
const css = read(stylesheets[0]);
const android = read('app/src/main/java/vn/nah/iso15189suite/MainActivity.java');
const theme = read('app/src/main/res/values/styles.xml');
const manifest = read('app/src/main/AndroidManifest.xml');

requires(js, 'margin:20mm 15mm 20mm 30mm', 'Print margins not compliant');
requires(js, 'function nahA4Landscape(el)', 'Wide table orientation detector absent');
requires(js, 'reduce((n,c)=>n+(c.colSpan||1),0)>=7', 'Wide table column span detector absent');
requires(js, 'font-family:"Times New Roman",serif', 'Browser print font missing');
requires(js, 'w:ascii="Times New Roman"', 'DOCX font missing');
requires(js, 'w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"', 'DOCX page margins missing');
requires(js, 'docxSignatureTable([\'THƯ KÝ (Ký, ghi rõ họ tên)\',\'CHỦ TỌA CUỘC HỌP', 'Meeting signatures incorrect');
requires(js, '.meetinglog-signature-table td{width:50%', 'Meeting signatures iframe layout missing');
requires(js, 'clone.style.padding=\'76px 57px 76px 113px\'', 'PDF capture margins missing');
requires(css, '@media print', 'Print CSS rules missing');
requires(css, '.meetinglog-signature-table', 'Meeting signature CSS missing');
requires(android, 'window.setStatusBarColor(Color.TRANSPARENT)', 'Status bar not transparent');
requires(android, 'window.setNavigationBarColor(Color.TRANSPARENT)', 'Navigation bar not transparent');
requires(android, 'controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars())', 'Native bars are not shown');
assert(!android.includes('controller.hide(WindowInsets.Type.statusBars()'), 'Fullscreen regression');
requires(android, 'WindowInsets.Type.ime()', 'Keyboard insets missing');
requires(theme, '@android:color/transparent', 'Native theme not transparent');
requires(manifest, 'android:windowSoftInputMode="adjustResize"', 'Input adjustment missing');

console.log('PASS: identical mirrors; JavaScript syntax; A4/DOCX/signatures; transparent Android bars; insets.');
console.log('HOLD: no APK device test and no rendered QA for all 83 templates on Web v1.58.59.');
