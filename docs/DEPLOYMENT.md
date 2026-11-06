# Deployment Guide

This template is pre-configured for deployment on **Netlify**. It can also be
deployed to any static hosting platform that supports Node 22+ builds.

---

## Netlify (recommended)

### First deployment

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Log in to [Netlify](https://app.netlify.com) and click **Add new site → Import an existing project**.
3. Connect your Git provider and select the repository.
4. Netlify will auto-detect the build settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: 22
5. Click **Deploy site**.

### Continuous deployment

Every push to the `main` branch triggers a new production deploy. Pull requests
get deploy previews automatically.

### Environment variables

Set environment variables in **Site settings → Environment variables** in the
Netlify UI, or via the Netlify CLI:

```bash
netlify env:set PUBLIC_SITE_URL https://yoursite.com
```

Required variables:

| Variable | Description |
|----------|-------------|
| (none required) | The template works without any env vars |

Optional variables (from `.env.example`):

| Variable | Description |
|----------|-------------|
| `PUBLIC_SITE_URL` | Canonical site URL — should match `site` in `astro.config.mjs` |
| `PUBLIC_SITE_TITLE` | Site name used in metadata |
| `PUBLIC_SITE_DESCRIPTION` | Default meta description |

### Custom domain

1. Go to **Site settings → Domain management → Add custom domain**.
2. Follow the DNS instructions for your registrar.
3. Netlify provisions a free TLS certificate automatically via Let's Encrypt.

### Security headers

Security headers are configured in `netlify.toml` and apply to all routes:

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — restricts camera, microphone, geolocation
- `Content-Security-Policy` — restricts resource origins

Adjust the CSP header in `netlify.toml` if you add third-party scripts or fonts.

### Redirects

Add redirects in `netlify.toml`:

```toml
[[redirects]]
  from = "/old-path"
  to   = "/new-path"
  status = 301
```

---

## Other platforms

### Vercel

```bash
npm i -g vercel
vercel
```

Vercel auto-detects Astro projects. No additional configuration is needed.

### GitHub Pages

```bash
# Install the GitHub Pages adapter
npm install @astrojs/github-pages --save-dev
```

Then update `astro.config.mjs`:

```js
import github from '@astrojs/github-pages';

export default defineConfig({
  site: 'https://username.github.io',
  base: '/repo-name',
  integrations: [github(), mdx(), sitemap(), tailwind()],
});
```

Add a `.github/workflows/deploy.yml` workflow to build and push to the
`gh-pages` branch.

### Cloudflare Pages

1. Connect your Git repository in the Cloudflare dashboard.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Set the Node.js version to `22` in the environment variables:
   `NODE_VERSION=20`.

---

## Pre-deployment checklist

- [ ] Update `site` in `astro.config.mjs` to your production URL
- [ ] Update the `base_url` in `cloudcannon.config.yml`
- [ ] Set `PUBLIC_SITE_URL` environment variable on Netlify
- [ ] Review and tighten the `Content-Security-Policy` header
- [ ] Run `npm run build` locally and check for errors
- [ ] Run `npm run check` — no TypeScript errors
- [ ] Run `npm test` — all unit tests pass
- [ ] Run `npm run test:e2e` — all E2E tests pass against the dev server
- [ ] Confirm `sitemap-index.xml` and `robots.txt` are in `dist/`
- [ ] Test the deploy preview before merging to `main`
