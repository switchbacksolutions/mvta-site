# CLAUDE.md — AI Agent Guide for astro-template

This file is the authoritative reference for AI agents (Claude, Copilot, etc.)
working on this codebase. Read it before writing any code.

---

## Project overview

A production-ready Astro.js blog template. Key characteristics:

- **Static output** — no server runtime; every page is pre-rendered HTML
- **Zero client JS by default** — only the dark-mode toggle script ships JS
- **Content Collections** — type-safe Markdown/MDX blog posts validated by Zod
- **Tailwind CSS** — utility-first styling; no custom CSS frameworks
- **CloudCannon CMS** — editors manage content through a visual interface
- **Netlify hosting** — `netlify.toml` drives build, headers, and redirects

---

## Directory structure

```
astro-template/
├── CLAUDE.md                  ← this file
├── README.md
├── astro.config.mjs           ← Astro integrations + site URL
├── package.json
├── tsconfig.json
├── tailwind.config.mjs        ← theme extensions, content paths, dark mode
├── vitest.config.ts           ← unit test config
├── playwright.config.ts       ← E2E test config + webServer
├── netlify.toml               ← build, headers, redirects
├── cloudcannon.config.yml     ← CMS collections, inputs, structures
├── .env.example               ← documented env vars (never commit .env)
├── .gitignore
├── public/
│   └── favicon.svg            ← place static assets here (images, fonts, etc.)
├── src/
│   ├── components/
│   │   ├── BaseHead.astro     ← <head>: title, meta, OG, RSS autodiscovery
│   │   ├── Header.astro       ← sticky nav + dark-mode toggle
│   │   ├── Footer.astro       ← copyright + footer nav
│   │   └── FormattedDate.astro← <time> element with ISO datetime attribute
│   ├── content/
│   │   ├── config.ts          ← Zod schema for the "blog" collection
│   │   └── blog/              ← .md / .mdx blog posts
│   ├── layouts/
│   │   ├── BaseLayout.astro   ← HTML shell: BaseHead + Header + slot + Footer
│   │   └── BlogPostLayout.astro← hero image, post header, prose, back-link
│   ├── pages/
│   │   ├── index.astro        ← home page: hero + recent posts + features
│   │   ├── about.astro        ← about page
│   │   ├── blog/
│   │   │   ├── index.astro    ← blog listing (all published posts)
│   │   │   └── [...slug].astro← individual post (getStaticPaths)
│   │   └── rss.xml.ts         ← RSS feed endpoint
│   └── styles/
│       └── global.css         ← Tailwind layers + @layer components
├── tests/
│   ├── e2e/
│   │   ├── home.spec.ts       ← Playwright: home page tests
│   │   └── blog.spec.ts       ← Playwright: blog listing + post + RSS tests
│   └── unit/
│       └── example.test.ts    ← Vitest: utility function tests
└── docs/
    ├── TESTING.md
    └── DEPLOYMENT.md
```

---

## How to add a new blog post

1. Create a new file in `src/content/blog/` — use kebab-case, e.g.
   `my-new-post.md` or `my-new-post.mdx`.

2. Add the required frontmatter at the top:

```markdown
---
title: 'Your Post Title'
description: 'One or two sentences for SEO meta and post cards (aim for 150–160 chars).'
pubDate: '2024-06-01'          # ISO date string — required
updatedDate: '2024-06-15'      # optional; omit if never updated
heroImage: '/images/my-image.jpg'  # optional; place image in public/images/
tags:
  - astro
  - tutorial
draft: false                   # set true to exclude from build and RSS
---

Post body in Markdown here.
```

3. Frontmatter schema (all fields validated by `src/content/config.ts`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Used in `<title>`, OG tags, and listings |
| `description` | string | yes | 150–160 characters recommended |
| `pubDate` | date string | yes | Coerced to `Date`; ISO 8601 format |
| `updatedDate` | date string | no | Only shown if > `pubDate` |
| `heroImage` | string (URL) | no | Relative path from `public/` or absolute URL |
| `tags` | string[] | no | Defaults to `[]` |
| `draft` | boolean | no | Defaults to `false` |

4. The post is automatically included in:
   - The blog listing at `/blog`
   - The individual post page at `/blog/<slug>` (slug = filename without extension)
   - The RSS feed at `/rss.xml`
   - The sitemap at `/sitemap.xml`

Draft posts (`draft: true`) are excluded from all of the above.

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
- Use `dark:` variants for dark mode support.
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
Dark mode uses the `class` strategy. Toggle by adding/removing the `dark`
class on `<html>`. The Header component handles this with a `<script>` block.

```html
<!-- Light -->
<html class="">
<!-- Dark -->
<html class="dark">
```

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
- **blog** → `src/content/blog/` — all `.md` and `.mdx` files
- **pages** → `src/pages/` — static pages

### Editing frontmatter
The `_inputs` block in `cloudcannon.config.yml` maps every frontmatter field
to a CMS input widget (text, textarea, datetime, image, array, checkbox).
When you add a new frontmatter field to the Zod schema in
`src/content/config.ts`, also add a corresponding entry under `_inputs` in
`cloudcannon.config.yml`.

### Schemas (CloudCannon)
The `schemas` key under each collection points to a template file that
CloudCannon pre-populates when an editor creates a new document. If you add
this template, place it at `.cloudcannon/schemas/blog-post.md`.

### Upload paths
Images uploaded via the CMS are saved to `public/images/uploads/`.
Newsletter PDFs are saved to `public/documents/newsletters/` (set on the
`pdfFile` input).

---

## Netlify deployment

### Build settings (from netlify.toml)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 20

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

## Do's and Don'ts

### Do
- Keep components small and single-purpose.
- Co-locate `<style>` blocks with their component for truly component-specific
  styles that Tailwind cannot express.
- Run `npm run check` before committing — catches type errors and Astro issues.
- Keep `draft: true` on in-progress posts — they won't appear in builds.
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
- Don't set `draft: false` on a post that isn't ready to publish.
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
| Add blog post | Create `src/content/blog/my-post.md` |
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
