# CoS Knowledge

Derrick Hodge — unified personal & professional knowledge base.

- **Source:** Markdown in `docs/` (Blume content root)
- **Build:** [Blume](https://useblume.dev) (Astro-based, static)
- **Live:** https://cos.hodgederrick.com (Cloudflare Pages)
- **Fallback:** GitHub Pages (public) from the same build
- **Push to deploy:** any push to `main` builds and deploys both surfaces

## Structure

```
docs/
  index.md              # landing
  personal/            # life-side knowledge
    people/ health/ finances/ home/ learning/ goals/ travel/
  professional/        # work-side knowledge
    briefings/ projects/ workflows/ decisions/ commitments/ people/ cadence/
```

Every section opens with `index.md` following a fixed skeleton:
Description, Purpose, Content overview, Formatting guidelines, Recommended
tools. Every page carries a strict frontmatter contract —
`id`, `type`, `category`, `updated`, `tags` (validated at build time by
`blume.config.ts`) — so the tree can be parsed into a knowledge graph later.

## Local dev

```
npm install
npm run dev     # preview at localhost
npm run build   # static output in dist/
```

## Deploy credentials

- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub secrets (see
  `pass cloudflare-api-token` locally); raw token never committed.