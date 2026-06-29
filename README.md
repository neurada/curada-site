# Curada — deploy bundle for curada.bio

This bundle contains the **finished Curada landing page** and everything an AI coding agent
(Claude Code / Codex) needs to put it live on **www.curada.bio**.

## What to hand the agent
Open **`PROMPT.md`** and paste its contents to Claude Code / Codex, then point it at this folder.
That prompt is the full brief — goal, steps, acceptance checks, and constraints.

## What's in here
```
handoff_curada_deploy/
├── PROMPT.md          # ← paste this to the coding agent
├── README.md          # this file
└── site/              # the publish directory — deploy this folder as-is
    ├── index.html     # markup (logo, hero, FDA programs, footer)
    ├── styles.css     # all styling
    ├── script.js      # network-field canvas animation (vanilla JS)
    ├── _redirects     # Netlify / Cloudflare Pages redirects (www → apex)
    ├── _headers       # security + cache headers
    ├── vercel.json    # Vercel redirects + caching
    ├── robots.txt
    ├── sitemap.xml
    └── assets/
        └── og-image.png   # social share image (1200×630)
```

## The one-paragraph version
It's a static site — **no build step, no framework, no backend, no npm install.**
The publish/output directory is `site/`, the build command is empty. Host it on
**Cloudflare Pages** (recommended; `_redirects`/`_headers` are pre-written for it),
or Netlify / Vercel (config for both is also included). Set **curada.bio** as the
canonical apex domain and 301-redirect **www.curada.bio** to it. Enforce HTTPS. Done.

## Domain facts
- **Canonical host:** `https://curada.bio` (apex). `<link rel="canonical">` is already set in `index.html`.
- **Redirect:** `www.curada.bio` → `curada.bio` (301). On Cloudflare Pages this is a dashboard
  **Redirect Rule** (Pages `_redirects` matches paths, not hostnames); Netlify/Vercel pick it up
  from `_redirects` / `vercel.json` automatically.

## Do not
- Edit `index.html`, `styles.css`, or `script.js` — the design is final (logo, copy, layout, animation).
- Add analytics or third-party scripts. The only external request is the Google Fonts stylesheet.

## Run locally (sanity check)
Just open `site/index.html` in a browser, or `npx serve site` / `python3 -m http.server` from `site/`.
