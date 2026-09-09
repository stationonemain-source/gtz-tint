# GTZ Tint — "THE PASS" · STATE

**Read this first.** Spec site built to pitch **GTZ Tint LLC**, Fort Worth TX.
Started and shipped 2026-09-09.

- **Live:** https://stationonemain-source.github.io/gtz-tint/
- **Repo:** `stationonemain-source/gtz-tint` — `main` = workspace, `pages` = site at root (Pages serves `pages` / `/`)
- **Workspace:** `C:\Users\Circl\gtz-tint\` (PC only — not in the brain repo)
- **Status:** built, verified, deployed. **Not sent to GTZ.** No contact has been made.

## Who they are (verified from their own Instagram, 2026-09-09)

| | |
|---|---|
| Business | Gtz Tint LLC · [@gtz_tint](https://www.instagram.com/gtz_tint/) · 668 followers |
| Phone | 817-360-7676 (public, in their IG bio) |
| Where | Fort Worth, TX — **no Google Business listing and no street address exists.** Do not invent one. |
| Lanes | Automotive · Residential · Commercial |
| Film | **Ceramic XR** (named in their captions) |
| Language | Bilingual — "Hablamos Español"; one caption is entirely Spanish |
| Differentiator | Competed at **Tinter Battles 2026** — "one of the youngest competing on the big stage" |
| Scale | **One person, home-garage bay.** No showroom, no staff, no years-in-business claim. |

Jobs seen in the footage: Tesla Model 3 (×3), Ford F-150 (2026), Dodge Challenger SRT,
Dodge Charger, Ford Raptor, Ram, plus a residential install in **Alvarado, TX**.

## ⚠️ The legal trap — do not undo this

Their captions advertise **20% on side doors** and **15% on a Tesla sunroof**.
**Texas requires more than 25% VLT on front side windows** (Transportation Code §547.613).
20/15/5% are legal only on rear glass (with dual mirrors), sunroofs, or under a medical exemption.

So the site **never advertises a sub-25% shade for front doors**. The Shades ladder tags every
rung `Legal on front sides` or `Rear glass only`, and there is a whole Texas-law section. If
someone "simplifies" that away, the site starts recommending an illegal install to a real business.

## ⚠️ ffmpeg cannot write AVIF that Chrome can read

`ffmpeg -c:v libaom-av1 ... -f avif` (and `-f image2`) produce files with a correct
`ftypavif` brand that **ffmpeg reads back fine and Chrome 148 refuses** — `createImageBitmap`
throws "The source image could not be decoded". Verified in real Chrome, not just the preview pane.
**PIL 12's `Image.save(..., "AVIF")` writes AVIF Chrome accepts.** Everything here ships **WebP**
so no visitor can lose the film; PIL's WebP is also ~30% smaller than ffmpeg's libwebp at equal quality.

## ⚠️ The in-app Browser pane cannot verify this page

It reports `innerHeight: 0`, so `600vh` collapses to 0px, the canvas is 0×0 and rAF never fires.
Everything reported there is a lie. Verify with **real headless Chrome**:

```
cd verify && NODE_PATH="C:/Users/Circl/.claude/skills/scroll-film-studio/node_modules" node shots.js http://localhost:8811/ shots
cd verify && NODE_PATH="C:/Users/Circl/.claude/skills/scroll-film-studio/node_modules" node jank2.js http://localhost:8811/ 40
```

Dev server: `preview_start` with name `gtz-tint` (in `~/.claude/.claude/launch.json`, port 8811).

## The concept — Circle picked 1 **and** 2, blended

**Scrolling installs the tint.** The page opens as raw Texas sun — bleached, desaturated,
dark ink on a hot wall. A wet squeegee edge travels down the viewport; everything above it is
tinted, everything below is still in the sun. A VLT instrument counts 70 → 15 as it passes.
When the pass completes, **the hexagon LED grid ignites** — that is the payoff — and the hexagon
then becomes the architecture for the work gallery below. Ends in the Tinter Battles arena.

Film beats (150 WebP frames, 5 fps over a 30 s cut, 600vh driver):

| Beat | Source reel | In–out | What it shows |
|---|---|---|---|
| 1 HEAT | `DXw9lRLy3a4` | 29.9 → 33.9 | Red Tesla, open bay door, Texas daylight |
| 2 PULL | `DaVaphNvRau` | 27.0 → 33.5 | Teal film sheet on the glass, squeegee |
| 3 PASS | `DaGEy1xMvXR` | 44.0 → 51.0 | Hex grid mirrored on black paint |
| 4 REVEAL | `DbYj2tSJkyP` | 1.0 → 8.0 | Hex ceiling + GTZ-TINT mural + red Tesla |
| 5 INSIDE | `Dc_XzEbhGjD` | 59.5 → 65.0 | Dark cabin, hex glowing through tinted roof |

Beat 1 has interior cutaways at 29 s and 34 s — **stay inside 29.9–33.9** or the site opens on a dashboard.

## Voice: first person, and "ONE SET OF HANDS" is load-bearing

The site speaks as **"we"** throughout (Circle's call, 2026-09-09). It shipped mixed — the
hero said "So we bring film" while the arena said "he competes", the work section said "his
own bay" and the booking headline said "tell him". A site that refers to its owner in the
third person reads like a profile written *about* him rather than his business talking to a
customer, so all five went first person.

**Do not delete "ONE SET OF HANDS" from the work headline.** It is what keeps "we" honest —
it tells the visitor plainly that this is one person, not a crew, which matters because
everything else about the operation (home bay, no staff) is something the copy deliberately
does not hide.

## Mobile is the primary case

Traffic arrives from an Instagram bio link, so the phone is the main event.
Audited on six real viewports (375 / 390 / 412 / 430 / landscape / tablet) with
`verify/mobile.js`, which reports horizontal overflow, sub-44px tap targets,
anchors hidden under the fixed header, and viewport-height handling:

```
cd verify && NODE_PATH="C:/Users/Circl/.claude/skills/scroll-film-studio/node_modules" node mobile.js http://localhost:8811/ mob
```

Six things it caught, all fixed and all easy to reintroduce:

1. **Every in-page anchor parked its heading under the fixed header** — clicking
   WORK put the headline behind the nav bar. `scroll-margin-top:88px` (header is 73px).
2. **The phone button was 38px tall** and the footer links 16px. Everything
   interactive now clears the 44px touch minimum.
3. **Three hexagons across a 390px screen is ~118px each.** Now two across at ~170px,
   and `.comb__row{display:contents}` dissolves the two three-cell rows so all six flow
   as one wrapping run — as rows they wrapped 2+1, 2+1 and looked broken.
4. **No hover on a phone, so five of six cell captions were invisible.** All six now
   show over a scrim. The 19% side padding is geometry, not taste: this hexagon's lower
   edges run from the mid-point out to 25%, so at 16% off the bottom the shape spans
   only 17%–83%. Narrower padding and the clip-path slices the label.
5. **`100vh` on a pinned stage is taller than iOS's visible area** while the URL bar
   shows, cutting the bottom off every beat. Now `100svh` (not `dvh` — dvh reflows mid-scroll).
6. **Landscape phone** pushed the headline off the top of a 390px-tall viewport.

### ⚠️ LITE — the low-data path

The film is 5.9 MB of frames. `navigator.connection.saveData`, or an `effectiveType`
of 2g/3g, **skips the frames entirely and keeps the poster** — 1 frame request instead
of 151. The squeegee, heat, instrument and every beat still run off scroll, so the
concept still lands; only the footage motion is gone. Force either path with `?lite=1`
/ `?full=1`. **If you ever make the poster decorative, LITE visitors get a blank hero.**

### ⚠️ Never take the poster from the concatenated mp4

`ffmpeg -i pass.mp4 -frames:v 1` returns a frame in **decode** order, not presentation
order, and it silently shipped a Tesla interior from the pre-fix cut as the poster —
which is the first thing every visitor sees, the `og:image` for link previews, and the
whole hero under LITE. **Derive it from `frames/f001.webp`** so the two cannot disagree:

```
python -c "from PIL import Image; Image.open('site/frames/f001.webp').convert('RGB').save('site/assets/poster.jpg','JPEG',quality=74,optimize=True,progressive=True)"
```

### ⚠️ `scroll-behavior:smooth` vs the `?jump` contract

Smooth scrolling animates `scrollTo`, so `settleAt()` reads the *old* position and lands
the film on the wrong frame. `film.js` forces `scroll-behavior:auto` whenever `?jump` is
present. Verify with the jump check: asked-y must equal landed-y at every beat.

## Rebuilding the film

`media/` is **git-ignored and PC-only** (108 MB of their reels). To rebuild:

```
python -m pip install yt-dlp
cd media/raw && for c in $(cat codes.txt); do python -m yt_dlp -o "%(id)s.%(ext)s" "https://www.instagram.com/reel/$c/"; done
# then the five seg cuts above -> concat -> fps=5,hqdn3d=2:2:4:4,scale=740:-2,unsharp=5:5:0.4 -> PIL WebP q66
```

If a reel is ever deleted from Instagram it is unrecoverable — the local copies are the only ones.

## The logo is EXTRACTED, never redrawn

`site/assets/gtz-mark.webp` is their real Texas-outline mark, keyed out of the footage by
**temporal-range keying**: sample 30 frames of the same crop from one clip, and where the
per-pixel range across frames is ~0 it is the static watermark; where it is large it is
background. Works because the mark is static within a clip (it drifts *between* clips, so
only ever key from one). Source: `DaGEy1xMvXR`, crop `430:430:0:1495`.

## Performance

Real Chrome, full scrub: **p50 7 ms · p95 7.6 ms · max 32 ms · zero frames over 40 ms.**
Three things bought that, all of which will silently regress if removed:

1. **The header uses a scrim, not `backdrop-filter`.** Creating that layer on the first scroll
   cost one 76 ms frame at y=225, every time.
2. **The ambient layer blurs at 240 px then scales ×8.** `filter` runs before `transform`, so a
   13 px blur on a small box replaces a 52 px blur on a full-viewport one.
3. **Boot pre-warm of the bitmap window**, spread over 14 × 60 ms slices — never one burst,
   which is the spike it exists to avoid.

Payload: **8.8 MB total, ~1.4 MB to interactive** (html+css+js+poster+logo = 164 KB, first 24
frames = 1.2 MB); the rest of the film streams in behind a progress bar.

Accessibility: **0 violations** (accesslint, WCAG AA) at `?flat=1&jump=0` and `?flat=1&jump=6200`.
`?flat=1` disables reveal transitions — without it a contrast checker samples elements mid-fade
and invents ~17 failures that are not real.

## Open / next

- [ ] **Nothing has been sent to GTZ.** No email address is known — contact is IG DM or the phone.
- [ ] The site is **publicly deployed** and uses their footage. If Circle would rather show it
      privately first, take the repo private and share screenshots instead.
- [ ] Hours are unknown, so the site says "by appointment" — true for a home bay, but confirm.
- [ ] The booking CTA is **phone + Instagram only**. No form, nothing wired to n8n (spec build).
- [ ] If they say yes: real domain, a form → n8n → Discord #ops, and a Google Business listing
      is the single highest-value thing they are missing.
