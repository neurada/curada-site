# PROMPT — paste this to Claude Code / Codex

> You are deploying a **finished static website** to the custom domain **curada.bio**.
> The site is in the `site/` folder of this bundle. It is **plain HTML/CSS/JS — no build step, no framework, no backend, no dependencies.** Do not rewrite, "modernize", reframe, or refactor it. Ship it exactly as-is. Your job is hosting + DNS only.
>
> ## Goal
> - Production site live at **https://curada.bio** (apex / canonical).
> - **https://www.curada.bio → https://curada.bio** via 301 redirect.
> - HTTPS enforced, valid certificate.
> - The publish/output directory is `site/` and the build command is **empty** (nothing to build).
>
> ## Steps
> 1. Put `site/` under version control (init a git repo at the bundle root if there isn't one) and push to a new GitHub repo named `curada-site` (ask me to authorize GitHub if needed).
> 2. Deploy on **Cloudflare Pages** (preferred — `_redirects` and `_headers` are already written for it). If I tell you I use Netlify or Vercel instead, use that path — config for all three is already in the repo (`_redirects`, `_headers`, `vercel.json`).
>    - **Build command:** _(none)_
>    - **Output directory:** `site`
> 3. Add the custom domain **curada.bio** to the project and set it canonical.
> 4. Add **www.curada.bio** and make it 301-redirect to the apex:
>    - Cloudflare Pages: `_redirects` only matches paths, so create a dashboard **Redirect Rule** `www.curada.bio/*` → `https://curada.bio/${1}` (301). (Netlify/Vercel handle the host redirect from `_redirects`/`vercel.json` automatically.)
> 5. Point DNS for curada.bio at the host (the registrar's nameservers or the CNAME/A records the host gives you), wait for the certificate to issue, and confirm HTTPS works on both hosts.
>
> ## Acceptance checks (run these and report results)
> - `curl -sI https://curada.bio` → `200`, `content-type: text/html`.
> - `curl -sI https://www.curada.bio` → `301` with `location: https://curada.bio/`.
> - `curl -sI http://curada.bio` → upgrades to HTTPS.
> - Page renders: animated network-field canvas behind the hero, `[Cu] Curada` logo top-left, no console errors.
> - `https://curada.bio/robots.txt` and `https://curada.bio/sitemap.xml` resolve.
>
> ## Hard constraints
> - **Do not edit** `index.html`, `styles.css`, or `script.js` (content, layout, copy, or the logo). If you believe something must change, ask me first.
> - Keep `curada.bio` as the single canonical host; everything else redirects to it.
> - No analytics, trackers, or third-party scripts unless I ask. The only external request the page makes is the Google Fonts stylesheet — leave it.
