/* Screenshot every beat + every section, desktop and mobile, then run the jank meter.
   Real Chrome via puppeteer-core — the in-app pane reports innerHeight 0 and never
   composites, so vh collapses and rAF never fires there. */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8811/';
const OUT = process.argv[3] || 'shots';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/* film progress -> scrollY, given driver 600vh: y = p * (6*H - H) = p*5H */
const beats = [
  ['01-heat', 0.00], ['02-film', 0.20], ['03-pass', 0.45],
  ['04-light', 0.70], ['05-inside', 0.96],
];
const sections = ['#work', '#film', '#shades', '#law', '#arena', '#book'];

async function shoot(page, file) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, file) });
  return file;
}

async function run(vp, tag) {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await b.newPage();
  await page.setViewport(vp);
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('requestfailed', r => errs.push('reqfail: ' + r.url().split('/').pop()));

  const done = [];
  for (const [name, p] of beats) {
    const y = Math.round(p * 5 * vp.height);
    await page.goto(BASE + '?jump=' + y, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    await new Promise(r => setTimeout(r, 420));
    done.push(await shoot(page, `${tag}-${name}.png`));
  }

  /* content sections: land on the section top */
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  for (const sel of sections) {
    const y = await page.evaluate(s => {
      const el = document.querySelector(s);
      return el ? Math.round(window.scrollY + el.getBoundingClientRect().top) : null;
    }, sel);
    if (y === null) continue;
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await new Promise(r => setTimeout(r, 700));
    done.push(await shoot(page, `${tag}-sec${sel.replace('#', '-')}.png`));
  }
  await b.close();
  return { shots: done, errors: [...new Set(errs)].slice(0, 10) };
}

async function jank() {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });
  const page = await b.newPage();
  await page.setViewport(DESKTOP);
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await page.evaluate(() => {
    window.__d = []; let last = performance.now();
    (function f() { const n = performance.now(); window.__d.push(n - last); last = n; requestAnimationFrame(f); })();
  });
  /* scrub the whole film in realistic steps */
  const H = DESKTOP.height;
  for (let y = 0; y <= 5 * H; y += 90) {
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await new Promise(r => setTimeout(r, 26));
  }
  const s = await page.evaluate(() => {
    const d = window.__d.slice(3).sort((a, b) => a - b);
    const q = p => d[Math.floor(d.length * p)];
    return { frames: d.length, p50: +q(.5).toFixed(1), p95: +q(.95).toFixed(1), max: +d[d.length - 1].toFixed(1) };
  });
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  await b.close();
  return { jank: s, heapMB: mem };
}

(async () => {
  const d = await run(DESKTOP, 'desk');
  const m = await run(MOBILE, 'mob');
  const j = await jank();
  console.log(JSON.stringify({ desktop: d, mobile: m, perf: j }, null, 2));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
