const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:8811/', { waitUntil: 'domcontentloaded' });
  const r = await p.evaluate(async () => {
    const files = ['frames/f001.avif', 'frames/_pil_q52.avif', 'frames/_pil_q62.avif', 'frames/_pil.webp'];
    const out = {};
    for (const f of files) {
      try { const bm = await createImageBitmap(await (await fetch(f)).blob()); out[f] = bm.width + 'x' + bm.height; }
      catch (e) { out[f] = 'FAIL'; }
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
