/* Real-Chrome probe. The in-app Browser pane reports innerHeight 0 and never
   composites, so vh collapses and rAF never fires there — this path is immune. */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:8811/';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => errs.push('reqfail: ' + r.url().split('/').pop() + ' — ' + (r.failure() || {}).errorText));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  let ready = false;
  try { await p.waitForFunction('window.__ready === true', { timeout: 45000 }); ready = true; } catch (e) { }

  const out = await p.evaluate(async () => {
    const q = s => document.querySelector(s);
    let frame = 'n/a';
    try {
      const r = await fetch('frames/f001.webp');
      const bm = await createImageBitmap(await r.blob());
      frame = bm.width + 'x' + bm.height;
    } catch (e) { frame = 'FAIL ' + e.message; }
    let webpOK = 'n/a';
    try {
      const im = new Image();
      webpOK = await new Promise(res => { im.onload = () => res('ok'); im.onerror = () => res('fail'); im.src = 'assets/gtz-mark.webp'; });
    } catch (e) { webpOK = 'err'; }
    const cv = q('#cv');
    return {
      innerH: innerHeight, innerW: innerWidth,
      driverH: q('#driver') && q('#driver').offsetHeight,
      stageH: q('#stage') && q('#stage').offsetHeight,
      paneW: q('#pane') && Math.round(q('#pane').getBoundingClientRect().width),
      paneH: q('#pane') && Math.round(q('#pane').getBoundingClientRect().height),
      canvas: cv ? cv.width + 'x' + cv.height : 'none',
      paneLive: q('#pane') && q('#pane').classList.contains('live'),
      bodyH: document.body.scrollHeight,
      frameDecode: frame, webp: webpOK,
      fonts: document.fonts ? document.fonts.status : 'n/a',
    };
  });
  out.__ready = ready;
  out.errors = errs.slice(0, 12);
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
