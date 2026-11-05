# Handoff: White-label adult editorial magazine — design system + homepage

## Overview
A premium digital magazine covering adult entertainment (editorial journalism, reviews, culture, curated video). Working title "Ass to Mouth" (placeholder, swappable). The platform will later be white-labelled, so everything is token-driven: one brand colour, three type pairings, light/dark mode, logo + favicon slots.

Deliverables: design system, homepage in two layout directions (1a "The Feed", 1b "The Issue") at desktop (1440) and mobile (390), and an age gate. Mobile-first.

## About the Design Files
The `.dc.html` files are **design references built in HTML**: prototypes showing intended look and behaviour, not production code. Recreate them in the target codebase's environment (React/Next, Vue, etc.) using its patterns. If no codebase exists, Next.js + CSS variables (or Tailwind mapped to the tokens below) is a good fit. Server-render the page; it is content-led and SEO-critical.

## Fidelity
**High-fidelity** for layout, type, colour, spacing, components. Imagery is placeholder (striped blocks with captions describing the intended non-explicit fashion/editorial/abstract shot). Copy is dummy.

## Direction to build
Client has not picked between 1a and 1b yet. Build the section components so both can be supported, or confirm the pick first. Both share all tokens and components.

## Design Tokens
All styling reads CSS custom properties on `:root`. Swapping these re-themes everything.

### Brand (swappable)
- `--brand` default `#7A1F3D` (burgundy). Alternates shown: `#1F3FD6`, `#0E7C66`, `#E8571F`.
- `--on-brand`: auto black `#121110` or white `#FFFFFF` — choose black when relative luminance of brand > 0.36.
- `--brand-text` (brand colour used as text on neutrals, must hit 4.5:1): light mode `color-mix(in oklch, brand 86%, black)` (45% if brand is light); dark mode `color-mix(in oklch, brand 72%, white)` (brand itself if light).
- Brand is used only for: wordmark full stop, kickers, score badges/rings/stars, primary buttons, active nav underline, Editor's pick label, newsletter block (1a), brand tints in grid overlay.

### Neutrals
Light: bg `#FFFFFF`, surface `#F4F5F7`, raised `#E6E8EC`, ink `#101216`, muted `#565B66`, line `#D8DBE1`.
Dark: bg `#0E1013`, surface `#15171B`, raised `#1E2126`, ink `#F2F4F7`, muted `#9AA1AD`, line `#2B2F36`.
Video band (both modes, fixed dark): bg `#0E1013`, text `#F2F4F7`, secondary `#9AA1AD`, ad slot `#15171B` with border `#2B2F36`, empty star `#3A3F47`, body `#C9CED6`.
Image placeholder tones (fixed): `#3B1F25 #1E2733 #2C2A2E #3A2E22 #22283A #2A2B30` etc, with 135° 1px stripe overlay `rgba(255,255,255,.05)` every 13px.

### Type pairings (choose one per publisher)
| Name | Display (`--fd`) | Body (`--fb`) | `--dw` | `--dt` | `--dls` | `--dlh` | `--dsz` |
|---|---|---|---|---|---|---|---|
| Couture (default) | Bodoni Moda | Hanken Grotesk | 600 | none | -0.015em | 1 | 1 |
| Poster | Anton | Archivo | 400 | uppercase | 0.005em | 0.98 | 0.9 |
| Literary | Instrument Serif | Schibsted Grotesk | 400 | none | -0.01em | 1 | 1.12 |
Mono (all pairings): IBM Plex Mono 400/500 (`--fm`) for kickers, meta, labels.
Every display font-size is written `calc(Npx * var(--dsz))` so pairings with different x-heights stay balanced.

### Type scale (display fonts use clamp, fluid between 390 and 1440)
- display-xl 132→48 (1b cover headline / masthead 11.6cqw), display-l 80→42 (1a hero), display-m 64→36 (1b section titles; 1a 48→30), headline-l 46→32, headline-m 27→20, card titles 25–28.
- body-l 19/1.55 (standfirst), body 17/1.6, ui 15/600, small 13–16.
- kicker: mono 11px, +0.12em, uppercase, 500, `--brand-text`. meta: mono 11px, +0.1em, uppercase, `--muted`.
- Minimum body text 15px; mobile tap targets ≥44px.

### Spacing / grid / shape
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Desktop: 12 col, 64px margin (4.45cqw), 24–32 gutter. Mobile: 4 col, 20px margin, 16 gutter.
- Section vertical padding `clamp(36px, 4cqw, 64px)`; side padding `clamp(20px, 4.45cqw, 64px)`. Layout uses container queries (`container-type:inline-size`, `cqw` units), so components adapt to their container.
- Radius 0 everywhere except 50% (play button, score ring). No shadows. Hairlines 1px `--line`; section heads have a 2px `--ink` top rule.

## Components
- **Buttons**: Primary (brand bg, on-brand text, 600). Sizes L 56 / M 44 / S 36px high. Secondary: ink bg or 1.5px ink outline. Text button: mono 12 caps with 1px underline. Disabled: raised bg, muted text. Icon buttons 44×44.
- **Tags**: kicker (above); type chip (`Article` outline / `▶ Video` ink fill, mono 10 caps); duration chip (mono 11, `rgba(0,0,0,.78)` bg, white); Editor's pick (brand fill, mono 10 caps); `● Best New Release` label; `18+` outline chip; category pill 40px high (active = ink fill).
- **Score badges** (5 stars, half steps; the numeral and stars are always shown together; add `aria-label="Rated 4.5 out of 5"`): XL ring (148px circle, 3px brand border, display numeral 62px) for lead review; L block (brand bg, numeral 44px + stars 14px) overlaid bottom-left on review images; compact block 84px wide (1b list); S inline (stars + numeral, mono 13) on video cards. Partial star = clipped overlay of filled star at width %.
- **Cards**: Story (3:2 image, kicker+date, headline, dek, byline), Review (4:5 image + score block, title, studio·year, verdict), Video (16:10, centred 48px play circle, duration bottom-right, title, studio + inline score), Category tile (3:4 image + name + count), News row (time + kicker + headline, grid 64px/1fr), Trending row (rank numeral, type chip, title, meta, 96px square thumb in 1a).
- **Navigation**: Desktop 1a: logo left; Search / My Favorites / Contact Us / "Get the newsletter" primary right; category row below with 2px brand underline on active. 1b: dateline row, giant centred masthead (≈11.6cqw), category row between 1px ink rules, mono caps 13px. Mobile: logo + search + hamburger (44px targets), horizontally scrolling category rail (no scrollbar). Mobile menu: full ink panel, display-font links 30px with hairline dividers, ✕ close.
- **Nav items**: Latest videos, Best Of, Brunette, Blonde, Black, AI; utility: My Favorites, Contact Us.
- **Ad slots**: always labelled "Advertisement" (mono 10 caps muted), on `--raised`, 1px line border, never inside a card/headline. Reserve exact heights to avoid layout shift. Header leaderboard 728×90 (m 320×50); Sidebar 300×600 (m 300×250); In-content 300×250 (also inside article body after paragraph 4); Between-grid 970×90 (m 320×100) as a full row after the first video row; Footer billboard 970×250 (m 300×250). Max one slot per mobile screen height.
- **Brand slots**: logo upload (SVG/PNG min 280×64) with fallback wordmark in display face plus brand-coloured full stop; favicon (square SVG or 512 PNG) with fallback = brand square + initial.

## Homepage sections (modular, reorderable)
Each is an independent block with a key, rendered from an ordered array `[{key, enabled}]` (CMS-driven). Default order:
1. `hero` — Hero feature: image, category kicker, date, headline, standfirst, byline/read time. 1a: split (image 1.65fr / text 1fr, text bottom-aligned). 1b: full-bleed cover, min-height clamp(560px, 52cqw, 780px), bottom gradient `rgba(10,9,9,.82)→0`, "Cover story" brand chip, headline max 12ch.
2. `latest` — Latest stories. 1a: 3-col grid desktop (48/32 gaps), mobile = lead card + compact rows with 96px square thumbs. 1b: "This week": 4:5 lead + two 3:2 cards + numbered "Also new" text list.
3. `reviews` — Featured reviews with scores. 1a: horizontal scroll-snap row of 4:5 cards, brand score block overlay. 1b: lead review (large image, XL ring + stars, 64px title, studio/year/reviewer, verdict) over a 3-col list of compact reviews. Background `--surface` with hairline top/bottom.
4. `trending` — Articles + videos mixed, ranked. Two-column list (auto-fill) with sidebar ad 300×600 (mobile 300×250). 1b rank numerals are outlined (transparent fill, 1.25px ink stroke).
5. `videos` — Featured video, fixed-dark band. 1a: 4-col grid (mobile 2-col), between-grid ad, second row. 1b: "Screening room" 16:9 lead (76px play) + description, "Watch now" and "Add to My Favorites" buttons, ad, then 3-col grid.
6. `picks` — Editor's picks. 1a: 3 scroll-snap 4:5 cards with "Editor's pick" brand tag. 1b: "The Edit", numbered columns with 2px ink top rule, 3:4 images.
7. `categories` — Popular categories. 1a: 6 image tiles (3:4). 1b: typographic index, giant display names (up to 84px) with count + thumbnail per row.
8. `news` — Compact list with timestamps, 300×250 in-content ad alongside (1b title "The Wire").
9. `newsletter` — Free newsletter only (no paid membership). 1a: brand-colour block. 1b: ink block, centred. Email input + submit, "Free. Unsubscribe anytime. 18+ only."
Footer: billboard ad, link columns (Sections/Watch, Read, Magazine, Legal incl. 2257 statement), wordmark, copyright with "All performers depicted were 18 or older…" and `18+` chip.

## Age gate
First-visit overlay. Desktop: 560px centred panel on dark blurred backdrop. Mobile: bottom sheet. Content: wordmark, "Adults only.", short explanation, primary "I'm 18 or older · Enter", outline "Leave", checkbox "Remember me on this device for 30 days", terms/privacy line. Persist consent in a cookie. Do not use for crawlers' content gating without legal review; add region-specific verification where required (e.g. EU/UK/US state laws).

## Interactions & Behaviour
- All cards are full-card links; hover = headline/kicker to `--brand-text`, no motion. Keep effects minimal for speed.
- Rails scroll horizontally with `scroll-snap-type:x mandatory`, hidden scrollbars.
- Video cards: poster + duration; optional muted hover/tap preview is undecided (client left it open).
- Search icon opens search; "My Favorites" requires lightweight local/account favourites; "Add to My Favorites" toggles.
- Responsive: layouts are container-query driven; breakpoints are effectively 390 (mobile frame) and 1440 (desktop frame) with fluid in between. Rails become stacked lists or scrollers; ads swap to mobile sizes.
- Theme: `data-theme=light|dark` toggles neutral tokens; respect `prefers-color-scheme`.

## State Management
- `theme`: { brand, typePairing, mode, publicationName, logo, favicon }, per-tenant config.
- `homepageSections`: ordered array `[{key, enabled}]` per tenant (admin-editable).
- `ageVerified` cookie; `favorites` list; newsletter form status.
- Data: stories, reviews (score 0–5 in 0.5 steps, badge, studio, year, verdict), videos (poster, duration, score, studio), news (timestamp, kicker), categories (count), editor picks. Ad slots from an ad server by slot ID.

## Assets
No real assets. Images are placeholders (caption labels give the art direction: editorial/fashion portraits cropped or blurred, abstract light, fabric, film-set stills — nothing explicit). Icons: inline SVG search, hamburger, play triangle, ★ glyph. Fonts via Google Fonts: Bodoni Moda, Hanken Grotesk, Anton, Archivo, Instrument Serif, Schibsted Grotesk, IBM Plex Mono (self-host in production; preload only the active pairing).

## Files
- `Design System.dc.html` — tokens, type scale, spacing, buttons, tags, score badges, cards, nav, ad slots, brand slots.
- `Homepage.dc.html` — canvas with 1a/1b at desktop + mobile, section reorder panel, age gate, theme tweaks (also holds all dummy content and theme logic in its script).
- `Home Feed.dc.html` — direction 1a markup/styles.
- `Home Issue.dc.html` — direction 1b markup/styles.
- `image-slot.js`, `support.js` — helper runtime for the prototypes (not for production).
