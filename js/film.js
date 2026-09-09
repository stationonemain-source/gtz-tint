/* ════════════════════════════════════════════════════════════════
   GTZ TINT — "THE PASS" scrub engine
   Scroll installs the tint: a wet squeegee edge travels down the
   viewport, and everything it crosses goes from raw Texas sun to
   tinted glass.

   Engine notes (hard-won, do not "simplify" these):
   · Frames are fetched as Blobs and decoded with createImageBitmap.
     new Image() makes Chrome retain decoded pixels on TOP of the
     bitmap window and the film's memory roughly doubles.
   · ensureBitmaps is BUDGETED (3 decodes per tick, nearest-first).
     Issuing a whole window at once lands as one ~150 ms frame at
     the same scroll point every time.
   · nearest() searches DECODED bitmaps only. drawImage on an
     undecoded image is a synchronous main-thread decode.
   · Keep-or-close is judged against the LIVE playhead, never a
     sentinel, or in-flight decodes thrash forever.
   · The rAF loop parks when there is provably nothing to animate.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* guarded DOM helpers — one unguarded listener on a missing node
     aborts this whole IIFE and every control below it dies silently */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function on(el, ev, fn, opt) { if (el && el.addEventListener) el.addEventListener(ev, fn, opt); }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeIO = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* LITE — the film is 5.9 MB of frames. On a metered or slow connection that is a
     real cost to a real person standing in a parking lot, so skip the frames entirely
     and keep the poster. The squeegee, the heat, the instrument and every beat still
     run off scroll, so the idea still lands; only the footage motion is gone. */
  var CONN = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  var LITE = !!(CONN && (CONN.saveData === true ||
    /^(slow-2g|2g|3g)$/.test(CONN.effectiveType || '')));

  var QS = new URLSearchParams(location.search);
  if (QS.has('lite')) LITE = true;      /* for verification */
  if (QS.has('full')) LITE = false;
  /* ?flat — kill every reveal transition so an auditor samples settled colours.
     Without it a contrast checker reads elements mid-fade and invents failures. */
  var FLAT = QS.has('flat');
  if (FLAT) document.documentElement.classList.add('flat');
  var JUMP = QS.get('jump');
  if (JUMP !== null) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    /* smooth scrolling animates scrollTo, so settleAt would read the OLD position
       and land the film on the wrong frame — the harness must scroll instantly */
    document.documentElement.style.scrollBehavior = 'auto';
  }

  /* ───────────────────────── film ───────────────────────── */
  var N = 150;
  var driver = $('#driver'), stage = $('#stage'), pane = $('#pane');
  var cv = $('#cv'), amb = $('#amb'), heat = $('#heat'), bead = $('#bead');
  var inst = $('#inst'), vltEl = $('#vlt'), instbar = $('#instbar'), chapEl = $('#chapter');
  var cue = $('#cue'), loader = $('#loader'), loadbar = $('#loadbar'), poster = $('#poster');
  var beats = $$('.beat').map(function (b) {
    return { el: b, in: +b.dataset.in, peak: +b.dataset.peak, out: +b.dataset.out, a: -1, y: 0 };
  });

  var ctx = cv ? cv.getContext('2d', { alpha: false, desynchronized: true }) : null;
  var actx = amb ? amb.getContext('2d', { alpha: false }) : null;

  var blobs = new Array(N), bitmaps = new Map(), decoding = new Set();
  var loaded = 0, center = -999, drawn = -1, playhead = 0, target = 0;
  var B_AHEAD = 8, B_KEEP = 11, BUDGET = 3;
  var DPR = Math.min(1.5, window.devicePixelRatio || 1);

  var PASS_A = 0.10, PASS_B = 0.44;   /* the squeegee's travel window */
  var CHAPTERS = [[0.13, 'TEXAS SUN'], [0.35, 'CERAMIC XR'], [0.58, 'THE PASS'], [0.82, 'THE LIGHT'], [9, 'INSIDE']];

  function url(i) { return 'frames/f' + String(i + 1).padStart(3, '0') + '.webp'; }

  /* ── loader: concurrency-capped, in index order so the opening is usable first ── */
  var qi = 0, INFLIGHT = 8;
  function pump() {
    while (qi < N && INFLIGHT > 0) {
      INFLIGHT--;
      (function (i) {
        fetch(url(i)).then(function (r) { return r.ok ? r.blob() : null; })
          .then(function (b) { blobs[i] = b; })
          .catch(function () { blobs[i] = null; })
          .then(function () {
            loaded++; INFLIGHT++;
            if (loadbar) loadbar.style.width = (loaded / N * 100).toFixed(1) + '%';
            if (loaded === 24 && pane) { pane.classList.add('live'); kick(); }
            if (loaded >= N && loader) loader.classList.add('done');
            pump();
          });
      })(qi++);
    }
  }

  function decode(b) { return window.createImageBitmap ? createImageBitmap(b) : Promise.reject(); }

  function ensureBitmaps(c) {
    center = c;
    bitmaps.forEach(function (bm, k) {
      if (k < center - B_KEEP || k > center + B_KEEP) { bm.close(); bitmaps.delete(k); }
    });
    var budget = BUDGET;
    for (var d = 0; d <= B_AHEAD && budget > 0; d++) {
      var cands = d === 0 ? [c] : [c + d, c - d];
      for (var j = 0; j < cands.length && budget > 0; j++) {
        var f = cands[j];
        if (f < 0 || f >= N || bitmaps.has(f) || decoding.has(f) || !blobs[f]) continue;
        decoding.add(f); budget--;
        (function (f) {
          decode(blobs[f]).then(function (bm) {
            decoding.delete(f);
            if (Math.abs(f - center) > B_KEEP) { bm.close(); return; }   /* judged against the LIVE playhead */
            bitmaps.set(f, bm);
            if (f === drawn || f === Math.round(playhead)) { drawn = -1; kick(); }
          }).catch(function () { decoding.delete(f); });
        })(f);
      }
    }
  }

  /* decoded bitmaps only — never a sync decode on the main thread */
  function nearest(i) {
    for (var d = 1; d <= 24; d++) {
      var a = bitmaps.get(i - d); if (a) return a;
      var b = bitmaps.get(i + d); if (b) return b;
    }
    return null;
  }

  function size() {
    if (cv && pane) {
      var w = Math.round(pane.clientWidth * DPR), h = Math.round(pane.clientHeight * DPR);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; drawn = -1; }
    }
    if (amb && (amb.width !== 96)) { amb.width = 96; amb.height = 170; }
  }

  function draw(i) {
    if (!ctx || !cv.width) return false;
    var idx = clamp(Math.round(i), 0, N - 1);
    if (drawn === idx) return true;
    var bm = bitmaps.get(idx) || nearest(idx);
    if (!bm) return false;
    var cw = cv.width, ch = cv.height, iw = bm.width, ih = bm.height;
    var sc = Math.max(cw / iw, ch / ih), dw = iw * sc, dh = ih * sc;
    ctx.drawImage(bm, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    if (actx) actx.drawImage(bm, 0, 0, 96, 170);
    drawn = idx;
    return true;
  }

  function progress() {
    if (!driver) return 0;
    var r = driver.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
  }

  var lastPass = -1, lastVlt = -1, lastChap = '', hdr = $('#hdr');

  function paintChrome(p) {
    /* the squeegee */
    var t = clamp((p - PASS_A) / (PASS_B - PASS_A), 0, 1);
    var pct = easeIO(t) * 100;
    if (Math.abs(pct - lastPass) > 0.05) {
      lastPass = pct;
      if (stage) {
        stage.style.setProperty('--pass', pct + '%');
        /* the beat copy sits mid-viewport, so it is in the sun until the edge clears it */
        stage.classList.toggle('hot', pct < 52);
      }
      if (bead) bead.classList.toggle('on', t > 0.001 && t < 0.999);
      /* the header sits in raw sun until the edge passes it */
      if (hdr) hdr.classList.toggle('on-light', pct < 9);
    }
    /* the instrument */
    var v = Math.round(lerp(70, 15, easeIO(clamp((p - 0.08) / 0.54, 0, 1))));
    if (v !== lastVlt && vltEl) { lastVlt = v; vltEl.textContent = v; }
    if (instbar) instbar.style.width = (p * 100).toFixed(1) + '%';
    var ch = '';
    for (var i = 0; i < CHAPTERS.length; i++) { if (p < CHAPTERS[i][0]) { ch = CHAPTERS[i][1]; break; } }
    if (ch !== lastChap && chapEl) { lastChap = ch; chapEl.textContent = ch; }
    if (inst) inst.classList.toggle('on', p > 0.015);
    if (cue) cue.classList.toggle('gone', p > 0.03);
  }

  function paintBeats(p) {
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i], a = 0;
      if (p >= b.in && p <= b.out) {
        if (p < b.peak) a = (p - b.in) / Math.max(1e-4, b.peak - b.in);
        else if (b.out > 1.5) a = 1;
        else a = 1 - (p - b.peak) / Math.max(1e-4, b.out - b.peak);
        a = clamp(a, 0, 1);
      }
      if (Math.abs(a - b.a) < 0.004) continue;
      b.a = a;
      b.el.style.opacity = a;
      b.el.style.visibility = a < 0.005 ? 'hidden' : 'visible';
      /* vertical centring lives in CSS `translate:`, so transform is ours alone */
      b.el.style.transform = 'translate3d(0,' + ((1 - a) * 22).toFixed(1) + 'px,0)';
    }
  }

  /* ── rAF that parks itself ── */
  var running = false, idleFrames = 0;
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  function tick() {
    var p = progress();
    target = p * (N - 1);
    var d = target - playhead;
    playhead += d * 0.16;
    if (Math.abs(d) < 0.02) playhead = target;

    var painted = true;
    if (!LITE) {
      var idx = Math.round(playhead);
      if (Math.abs(idx - center) >= 2) ensureBitmaps(idx);
      painted = draw(playhead);
    }
    paintChrome(p);
    paintBeats(p);

    var settled = Math.abs(d) < 0.02 && painted && !decoding.size;
    idleFrames = settled ? idleFrames + 1 : 0;
    if (idleFrames > 3) { running = false; return; }     /* park */
    requestAnimationFrame(tick);
  }

  if (!REDUCED && driver && cv) {
    size();
    on(window, 'resize', function () { size(); drawn = -1; kick(); });
    on(window, 'scroll', kick, { passive: true });
    on(window, 'orientationchange', function () { size(); drawn = -1; kick(); });

    if (LITE) {
      /* Poster stays, and it seeds the ambient bleed so the room behind the glass
         still carries the film's colour instead of going flat black. Everything
         below this block still runs — cells, arena, reveals, the dev contract. */
      if (loader) loader.classList.add('done');
      var seed = function () { try { actx.drawImage(poster, 0, 0, 96, 170); } catch (e) { } };
      if (poster && actx) { poster.complete ? seed() : on(poster, 'load', seed); }
      kick();
    } else {
      pump();
      ensureBitmaps(0);
      kick();
      /* Fill the opening window BEFORE the first scroll, a budgeted slice at a time.
         Without this the window ramps up during the first ~300px of scroll and lands
         as two 60-70 ms frames right where the visitor starts moving. Spread, never
         burst — one big ensureBitmaps call is the spike it is meant to avoid. */
      (function prewarm(n) {
        if (n <= 0) return;
        center = -999;                     /* force a rescan of the same window */
        ensureBitmaps(Math.round(playhead));
        setTimeout(function () { prewarm(n - 1); }, 60);
      })(14);
    }
  } else {
    /* reduced motion: the film is a still, every beat is just stacked copy */
    if (loader) loader.classList.add('done');
    if (poster) poster.style.opacity = '1';
    beats.forEach(function (b) { b.el.style.opacity = 1; });
  }

  /* ───────────────────── hex cells ───────────────────── */
  var TOUCH = window.matchMedia && window.matchMedia('(hover: none)').matches;
  var cells = $$('.cell');

  function activate(cell) {
    if (!cell || cell._v) return;
    var src = cell.dataset.src; if (!src) return;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.preload = 'auto'; v.src = src; v.setAttribute('aria-hidden', 'true');
    cell._v = v;
    var host = $('.cell__in', cell); if (!host) return;
    host.appendChild(v);
    var play = v.play(); if (play && play.catch) play.catch(function () { });
    cell.classList.add('playing');
  }
  function deactivate(cell) {
    if (!cell || !cell._v) return;
    try { cell._v.pause(); } catch (e) { }
    cell._v.removeAttribute('src'); cell._v.load();
    if (cell._v.parentNode) cell._v.parentNode.removeChild(cell._v);
    cell._v = null; cell.classList.remove('playing');
  }

  if (!REDUCED) {
    if (TOUCH) {
      /* phones: exactly one cell runs — whichever is nearest the middle of the screen */
      var visible = new Map(), settleT = 0;
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible.set(e.target, e.isIntersecting ? e.intersectionRatio : 0); });
        clearTimeout(settleT);
        settleT = setTimeout(function () {
          var best = null, bv = 0.34;
          visible.forEach(function (r, el) { if (r > bv) { bv = r; best = el; } });
          cells.forEach(function (c) { if (c !== best) deactivate(c); });
          if (best) activate(best);
        }, 140);
      }, { threshold: [0, .35, .6, .85] });
      cells.forEach(function (c) { cio.observe(c); });
    } else {
      cells.forEach(function (c) {
        on(c, 'mouseenter', function () { activate(c); });
        on(c, 'mouseleave', function () { deactivate(c); });
        on(c, 'focusin', function () { activate(c); });
        on(c, 'focusout', function () { deactivate(c); });
      });
    }
  }

  /* ───────────────────── arena ───────────────────── */
  var av = $('#arenavid');
  if (av && !REDUCED) {
    var aio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          if (!av.src) av.src = 'assets/arena.mp4';
          var pr = av.play(); if (pr && pr.catch) pr.catch(function () { });
        } else { try { av.pause(); } catch (x) { } }
      });
    }, { threshold: 0.2 });
    aio.observe(av);
  }

  /* ───────────────────── reveals + sticky header ───────────────────── */
  /* Reveal grid CONTAINERS, not their children: these grids draw their hairlines with
     a 1px gap over a light background, so fading the children out leaves the container
     showing as a solid grey slab until the observer fires. */
  var rvSel = '.sec__head, .cell, .why__list, .ladder, .law__list, .lanes, .book__acts, .book__facts, .arena__copy .lede';
  var rvs = $$(rvSel);
  rvs.forEach(function (el, i) { el.classList.add('rv'); el.style.transitionDelay = (Math.min(i % 6, 5) * 55) + 'ms'; });
  if (rvs.length) {
    if (REDUCED) { rvs.forEach(function (el) { el.classList.add('in'); }); }
    else {
      var rio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      rvs.forEach(function (el) { rio.observe(el); });
    }
  }
  on(window, 'scroll', function () {
    if (hdr) hdr.classList.toggle('stuck', window.scrollY > 40);
  }, { passive: true });

  /* ───────────────────── dev contract ───────────────────── */
  function settleAt(y) {
    window.scrollTo(0, y);
    var p = progress();
    playhead = target = p * (N - 1);
    if (LITE) { paintChrome(p); paintBeats(p); return Promise.resolve(); }
    var idx = Math.round(playhead);
    ensureBitmaps(idx);
    return new Promise(function (res) {
      var tries = 0;
      (function wait() {
        drawn = -1;
        var ok = draw(playhead);
        paintChrome(p); paintBeats(p);
        if (ok || ++tries > 90) return res();
        ensureBitmaps(idx);
        setTimeout(wait, 60);
      })();
    });
  }

  function ready() { window.__ready = true; }

  if (JUMP !== null) {
    var target_y = +JUMP || 0;
    var waitLoad = new Promise(function (res) {
      var t0 = Date.now();
      (function w() { if (LITE || loaded >= N || Date.now() - t0 > 25000) res(); else setTimeout(w, 100); })();
    });
    Promise.all([waitLoad, document.fonts ? document.fonts.ready : Promise.resolve()])
      .then(function () { if (pane) pane.classList.add('live'); return settleAt(target_y); })
      .then(function () { rvs.forEach(function (el) { el.classList.add('in'); }); })
      .then(function () { setTimeout(ready, 220); });
  } else {
    var t0 = Date.now();
    (function w() {
      if ((LITE || loaded >= 24 || Date.now() - t0 > 12000) && (!document.fonts || document.fonts.status === 'loaded')) ready();
      else setTimeout(w, 120);
    })();
  }

  /* jank meter — judge p95/max, never average fps */
  if (location.search.indexOf('jank') > -1) {
    var last = performance.now(), ds = [];
    (function j() {
      var n = performance.now(); ds.push(n - last); last = n;
      if (ds.length >= 120) {
        ds.sort(function (a, b) { return a - b; });
        console.log('[jank] p95=' + ds[Math.floor(ds.length * .95)].toFixed(1) +
          'ms max=' + ds[ds.length - 1].toFixed(1) + 'ms');
        ds = [];
      }
      requestAnimationFrame(j);
    })();
  }
})();
