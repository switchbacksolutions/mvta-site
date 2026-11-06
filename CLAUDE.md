# CLAUDE.md — AI Agent Guide for the MVTA website

This file is the authoritative reference for AI agents (Claude, Copilot, etc.)
working on this codebase. Read it before writing any code.

---

## Project overview

The website of the Meadow Vista Trails Association (MVTA), a trails nonprofit
in Meadow Vista, CA. It started from a generic Astro blog template; the blog
parts were removed. Key characteristics:

- **Static output** — every page is pre-rendered HTML. The only server code is
  two Netlify Functions for Stripe membership payments.
- **Little client JS** — small `<script>` blocks for the mobile menu, the join
  form, and the trail filters.
- **Content Collections** — trails, board, events, and newsletters as Markdown,
  validated by Zod in `src/content.config.ts`.
- **Tailwind CSS v4** — configured in `src/styles/global.css` (`@theme`); there
  is no `tailwind.config.mjs`.
- **CloudCannon CMS** — editors manage the collections through a visual interface.
- **Netlify hosting** — `netlify.toml` drives build, headers, and functions.
  `main` deploys to https://mvtrails.netlify.app. Launch steps are tracked in
  GitHub issue #6.

---

## Directory structure

```
├── astro.config.mjs           ← site URL, integrations, sitemap filter
├── netlify.toml               ← build, functions, security headers (CSP)
├── cloudcannon.config.yml     ← CMS collections and inputs
├── .cloudcannon/schemas/      ← templates for new CMS entries
├── netlify/
│   ├── functions/             ← create-checkout.js, stripe-webhook.js
│   └── lib/                   ← helpers for the functions (not deployed as functions)
├── public/
│   ├── images/                ← photos, logo, favicon; CMS uploads in images/uploads/
│   ├── documents/newsletters/ ← newsletter PDFs
│   ├── og-default.jpg         ← default social share image (1200×630)
│   ├── robots.txt
│   └── membership.pdf         ← paper membership form
├── src/
│   ├── components/            ← BaseHead, Header, Footer, FormattedDate
│   ├── content/               ← trails/, board/, events/, newsletters/
│   ├── content.config.ts      ← Zod schemas for the collections
│   ├── layouts/BaseLayout.astro
│   ├── lib/                   ← shared constants (e.g. membership portal URL)
│   ├── pages/                 ← routes, including trails/[slug].astro and 404.astro
│   └── styles/global.css      ← Tailwind import, @theme, @layer components
├── tests/
│   ├── e2e/                   ← Playwright (runs against netlify dev)
│   └── unit/                  ← Vitest
└── docs/                      ← TESTING.md, DEPLOYMENT.md
```

---

## How to add content

Add a Markdown file to the matching folder in `src/content/` (or use
CloudCannon). The file name becomes the slug. Required fields are defined in
`src/content.config.ts`; the CloudCannon templates in `.cloudcannon/schemas/`
list them.

| Collection | Folder | Shown on |
|------------|--------|----------|
| trails | `src/content/trails/` | `/trails` and `/trails/<slug>` |
| board | `src/content/board/` | `/board`, `/about` |
| events | `src/content/events/` | `/events` |
| newsletters | `src/content/newsletters/` | `/newsletters` |

Pages that should stay out of search results (like post-submit confirmations)
take a `noindex` prop on `BaseLayout`, and must also be added to
`NOINDEX_PATHS` in `astro.config.mjs` so the sitemap skips them.

---

## How to add a new page

Create an `.astro` file in `src/pages/`:

```astro
---
// src/pages/contact.astro
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout title="Contact" description="Get in touch.">
  <main class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
    <h1 class="text-4xl font-bold">Contact</h1>
    <!-- page content -->
  </main>
</BaseLayout>
```

The file path maps directly to the URL:
- `src/pages/contact.astro` → `/contact`
- `src/pages/work/index.astro` → `/work`
- `src/pages/work/[slug].astro` → `/work/<slug>`

---

## Component conventions

### File naming
- Astro components: `PascalCase.astro`
- TypeScript modules: `camelCase.ts`
- Test files: `kebab-case.spec.ts` or `kebab-case.test.ts`

### Props interface
Always declare a typed `Props` interface at the top of the frontmatter block:

```astro
---
interface Props {
  title: string;
  description?: string;
  variant?: 'primary' | 'secondary';
}

const { title, description, variant = 'primary' } = Astro.props;
---
```

### Path aliases
Use the `@/` alias for imports from `src/`:

```astro
import BaseLayout from '@/layouts/BaseLayout.astro';
import FormattedDate from '@/components/FormattedDate.astro';
```

### Slots
Use the default `<slot />` for main content injection. Named slots for
secondary regions:

```astro
<!-- In the layout -->
<aside><slot name="sidebar" /></aside>
<main><slot /></main>

<!-- In the page -->
<MyLayout>
  <Fragment slot="sidebar">...</Fragment>
  <p>Main content</p>
</MyLayout>
```

### Client-side JavaScript
Avoid client-side JS unless strictly necessary. When needed, use
`<script>` tags inside `.astro` files — they are automatically bundled
by Vite and scoped to the component.

Do NOT add `is:global` or `is:inline` unless you have a specific reason.

---

## Tailwind usage conventions

### Do's
- Use Tailwind utility classes for all styling.
- Add `dark:` variants so pages work in OS dark mode.
- Use the `@layer components` block in `global.css` for repeated patterns
  (e.g., `.btn-primary`, `.card`, `.tag-pill`).
- Use `class:list={[...]}` in Astro for conditional classes.

### Don'ts
- Do not write arbitrary inline `style` attributes unless Tailwind cannot
  express the value.
- Do not create new CSS files — extend `global.css` or use `<style>` blocks.
- Do not install `clsx` or `classnames` — Astro's `class:list` directive is
  sufficient.

### Dark mode
`dark:` variants follow the visitor's OS setting (the Tailwind v4 default).
There is no dark-mode toggle.

### Responsive design
Use Tailwind's responsive prefixes:
- `sm:` — 640 px +
- `md:` — 768 px +
- `lg:` — 1024 px +
- `xl:` — 1280 px +

Always design mobile-first: write the base class first, then add responsive
overrides.

---

## Testing workflow

### Unit tests (Vitest)

```bash
npm test               # run once
npm run test:watch     # watch mode
```

Place unit tests in `tests/unit/`. Test pure utility functions — not Astro
components. Import the function under test; do not mock Astro internals.

### E2E tests (Playwright)

```bash
npm run test:e2e           # run all browsers
npm run test:e2e:ui        # interactive UI mode
npx playwright test --headed  # visible browser
```

Place E2E tests in `tests/e2e/`. Prefer `getByRole` locators. Use
`data-testid` attributes sparingly, only when semantic roles are insufficient.

When adding a new page, add a corresponding E2E test file that covers:
- Page loads with status 200
- Key headings and content are visible
- Navigation links work
- Accessibility landmarks are present

---

## CloudCannon CMS notes

`cloudcannon.config.yml` defines how the CMS presents the content to editors.

The file uses CloudCannon's Unified Configuration format. Collections use
`glob`, `sort_options`, and `disable_url` (not `filter`, `sort`, or `output`).
Array item inputs use a `key[*]` entry under `_inputs`. Build settings live in
CloudCannon's Site Settings, not in this file.

### Collections
- **trails**, **board**, **newsletters**, **events** → `src/content/<name>/`
- **pages** → `src/pages/` — static pages

### Editing frontmatter
The `_inputs` block in `cloudcannon.config.yml` maps every frontmatter field
to a CMS input widget (text, textarea, datetime, image, array, document).
When you add a new frontmatter field to the Zod schema in
`src/content.config.ts`, also add a corresponding entry under `_inputs` in
`cloudcannon.config.yml`.

### Schemas (CloudCannon)
The `schemas` key under each collection points to a template file in
`.cloudcannon/schemas/` that CloudCannon pre-populates when an editor creates
a new entry.

### Upload paths
Images uploaded via the CMS are saved to `public/images/uploads/`.
Newsletter PDFs should be saved to `public/documents/newsletters/` (set on the
`pdfFile` input). Before the Unified Configuration change, CloudCannon saved
them to `public/images/uploads/`; confirm the next upload lands in the new folder.

---

## Netlify deployment

### Build settings (from netlify.toml)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 22

### Security headers
All routes receive these headers (see `netlify.toml`):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Content-Security-Policy`

If you add third-party scripts (analytics, embeds), update the CSP header in
`netlify.toml` to include the required origins.

### Adding redirects
Append to `netlify.toml`:

```toml
[[redirects]]
  from = "/old-url"
  to   = "/new-url"
  status = 301
```

---

## Membership payments (Stripe)

- `netlify/functions/create-checkout.js` starts Stripe Checkout from `/join`.
  It refuses (HTTP 409) when the email already has a live subscription, and
  reuses an existing customer record otherwise. Lookup helpers live in
  `netlify/lib/membership.js`, outside `netlify/functions` so Netlify does not
  deploy them as a function.
- `netlify/functions/stripe-webhook.js` emails the treasurer on
  `checkout.session.completed` and on automatic renewals (`invoice.paid` with
  `billing_reason: subscription_cycle`). The Stripe webhook must send both events.
- Members manage subscriptions in the Stripe customer portal. Its login page
  URL is `PUBLIC_STRIPE_PORTAL_URL`, read at build time through
  `src/lib/membership.ts`. Test and live mode have different URLs.

---

## Do's and Don'ts

### Do
- Keep components small and single-purpose.
- Co-locate `<style>` blocks with their component for truly component-specific
  styles that Tailwind cannot express.
- Run `npm run check` before committing — catches type errors and Astro issues.
- Update `CLAUDE.md` when you change the project structure, conventions, or
  add new tooling.

### Don't
- Don't commit `.env` — it is in `.gitignore` for a reason.
- Don't add client-side framework components (React, Vue, etc.) without a
  documented reason — Astro's goal is minimal JavaScript.
- Don't import from `node_modules` paths that bypass the alias — always use
  `@/` for `src/` paths.
- Don't modify `dist/` — it is generated on every build and ignored by git.
- Don't add `console.log` statements to production code.
- Don't change `astro.config.mjs` integrations without running a full build
  to verify nothing breaks.

---

## Environment variables

All public variables must be prefixed `PUBLIC_` to be accessible in Astro
client-side code. Server-only variables have no prefix.

Copy `.env.example` to `.env` for local development. Never commit `.env`.

On Netlify, set variables in **Site settings → Environment variables**.

---

## Common tasks reference

| Task | Command / File |
|------|---------------|
| Add trail, event, board member, newsletter | Add a file in `src/content/<collection>/` |
| Add static page | Create `src/pages/my-page.astro` |
| Add reusable component | Create `src/components/MyComponent.astro` |
| Update site URL | Edit `site` in `astro.config.mjs` |
| Update nav links | Edit `NAV_LINKS` in `src/components/Header.astro` |
| Update footer links | Edit `FOOTER_LINKS` in `src/components/Footer.astro` |
| Add redirect | Append `[[redirects]]` block in `netlify.toml` |
| Add CMS field | Update `_inputs` in `cloudcannon.config.yml` + Zod schema |
| Run all tests | `npm run test:all` |
| Type-check | `npm run check` |
| Build for production | `npm run build` |
