/* Mobile readiness audit: real device viewports + touch emulation.
   Reports horizontal overflow, tap-target sizes, anchor-under-header collisions,
   viewport-height handling, and whether the film actually runs under touch. */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = process.env.CHROME_PATH || 'C:/Users/Circl/AppData/Local/Google/Chrome/Application/chrome.exe';
const CHROME2 = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8811/';
const OUT = process.argv[3] || 'mob';

const VPS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'pixel-7', width: 412, height: 915 },
  { name: 'iphone-pro-max', width: 430, height: 932 },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'tablet', width: 768, height: 1024 },
];

(async () => {
  const exe = fs.existsSync(CHROME2) ? CHROME2 : CHROME;
  const b = await puppeteer.launch({
    executablePath: exe, headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const report = {};
  for (const vp of VPS) {
    const page = await b.newPage();
    await page.setViewport({ ...vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36');
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    await new Promise(r => setTimeout(r, 500));

    const r = await page.evaluate(() => {
      const out = {};
      out.overflowX = document.documentElement.scrollWidth - window.innerWidth;
      const widest = [...document.querySelectorAll('body *')]
        .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5).map(e => (e.tagName + '.' + (e.className || '').toString().split(' ')[0]).slice(0, 40)
          + ' →' + Math.round(e.getBoundingClientRect().right));
      out.overflowing = widest;

      /* tap targets: anything clickable under 44x44 CSS px */
      out.smallTargets = [...document.querySelectorAll('a,button,[role="button"],.cell')]
        .map(e => { const b = e.getBoundingClientRect(); return { s: (e.tagName + '.' + (e.className || '').toString().split(' ')[0]).slice(0, 34), w: Math.round(b.width), h: Math.round(b.height) }; })
        .filter(t => t.w > 0 && (t.w < 44 || t.h < 44));

      /* does the pinned stage match the visible viewport? */
      const st = document.querySelector('#stage');
      out.stageH = st ? Math.round(st.getBoundingClientRect().height) : null;
      out.innerH = window.innerHeight;
      out.stageMatchesViewport = out.stageH === out.innerH;

      /* anchor targets hidden under the fixed header */
      const hdrH = Math.round(document.querySelector('#hdr').getBoundingClientRect().height);
      out.headerH = hdrH;
      out.anchorsUnderHeader = ['#work', '#film', '#shades', '#law', '#book']
        .map(s => { const e = document.querySelector(s); if (!e) return null;
          const sm = parseFloat(getComputedStyle(e).scrollMarginTop) || 0;
          return sm < hdrH ? s + ' (scroll-margin ' + sm + 'px < header ' + hdrH + 'px)' : null; })
        .filter(Boolean);

      out.touchDetected = matchMedia('(hover: none)').matches;
      out.paneW = Math.round(document.querySelector('#pane').getBoundingClientRect().width);
      return out;
    });
    r.errors = [...new Set(errs)].slice(0, 5);
    report[vp.name] = r;

    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${vp.name}-hero.png` });
    const wy = await page.evaluate(() => Math.round(scrollY + document.querySelector('#work').getBoundingClientRect().top));
    await page.evaluate(y => scrollTo(0, y), wy);
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: `${OUT}/${vp.name}-work.png` });
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2));
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
