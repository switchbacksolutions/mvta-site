# Meadow Vista Trails Association website

The website of the Meadow Vista Trails Association (MVTA), a trails nonprofit in
Meadow Vista, California. It is a static Astro site with Tailwind CSS, edited in
CloudCannon and hosted on Netlify. Membership payments use Stripe Checkout
through Netlify Functions.

## Quick start

```bash
npm install
cp .env.example .env   # fill in the Stripe and Resend values
npm run dev            # http://localhost:4321
```

Use `npx netlify dev` (http://localhost:8888) to run the Netlify Functions and
the Stripe checkout flow locally.

## Scripts

```bash
npm run dev         # Start the dev server
npm run build       # Build for production → dist/
npm run check       # Type-check with astro check
npm test            # Vitest unit tests
npm run test:e2e    # Playwright E2E tests (starts netlify dev)
npm run test:all    # Unit + E2E tests
```

## Project layout

```
src/
  components/       Header, footer, <head>
  content/          trails, board, events, newsletters (Markdown, edited in CloudCannon)
  layouts/          Page shell
  lib/              Shared constants
  pages/            File-based routes
netlify/
  functions/        create-checkout (Stripe Checkout), stripe-webhook (treasurer email)
  lib/              Helpers for the functions
public/             Static files: images, newsletter PDFs, membership.pdf
tests/
  e2e/              Playwright tests
  unit/             Vitest tests
docs/               Testing and deployment guides
```

Agent and contributor conventions are in [CLAUDE.md](CLAUDE.md). Launch steps
are tracked in the GitHub issues.
