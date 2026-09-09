/* Locate slow frames, don't just count them: every frame over the threshold is
   reported with the scrollY and film progress it happened at. A spike that lands
   at the same progress in every run is a code path; a one-off at y=0 is startup. */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8811/';
const THRESH = +(process.argv[3] || 40);

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });
  const page = await b.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  /* let startup settle so we measure the scrub, not the boot */
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(t => {
    window.__slow = []; window.__all = [];
    let last = performance.now();
    (function f() {
      const n = performance.now(), d = n - last; last = n;
      window.__all.push(d);
      if (d > t) {
        const dr = document.querySelector('#driver').getBoundingClientRect();
        const p = Math.max(0, Math.min(1, -dr.top / (dr.height - innerHeight)));
        window.__slow.push({ ms: +d.toFixed(1), y: Math.round(scrollY), p: +p.toFixed(3) });
      }
      requestAnimationFrame(f);
    })();
  }, THRESH);

  for (let y = 0; y <= 4500; y += 75) {
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await new Promise(r => setTimeout(r, 30));
  }
  const out = await page.evaluate(() => {
    const d = window.__all.slice(3).sort((a, b) => a - b);
    const q = p => +d[Math.floor(d.length * p)].toFixed(1);
    return { frames: d.length, p50: q(.5), p95: q(.95), p99: q(.99), max: +d[d.length - 1].toFixed(1), slow: window.__slow };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
