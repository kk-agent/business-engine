---
name: business-engine-ship-loop
description: Iterative full-stack ship loop for Business Engine — thought-based reasoning, verification gates, Vercel Functions/React best practices, and deployment. Use when building or selling the YouTube-to-production SaaS product end-to-end.
---

# Business Engine Ship Loop

## Goal

Ship a **sellable** full-stack product: marketing site → studio app → API pipeline → Vercel production, with evidence at every gate.

**Product:** Business Engine — paste a YouTube tutorial URL, get skills, DAG, deploy artifacts, marketing copy, and execution plan.

**Completion promise (loop exit):** `BUSINESS_ENGINE_SHIPPED`

Only output this when ALL are true:
- `npm run build` exit 0
- `npm run lint` exit 0 errors
- `npm run type-check` exit 0
- `/api/health` returns `{ ok: true }` locally or on preview
- Public landing (`/`) + studio (`/studio`) + pricing (`/pricing`) render
- Vercel preview or production URL is live

---

## Loop phases (Least-to-Most)

| Phase | Focus | Primary skill |
|-------|--------|---------------|
| 1. Product | ICP, pricing, CTA, copy | thought-based-reasoning (Zero-shot CoT) |
| 2. Frontend | Landing, studio UX, perf | vercel-react-best-practices |
| 3. Backend | Route handlers, persistence, AI | vercel-functions |
| 4. Deploy | Env, preview, prod | vercel-deployment |
| 5. Verify | Fresh commands, no claims without evidence | verification-before-completion |

---

## Thought-based reasoning (customized)

### Technique selection

| Situation | Technique |
|-----------|-----------|
| Scope / pricing decisions | Zero-shot CoT: "Let's think step by step about who pays and why." |
| Architecture forks (DB vs KV vs memory) | Self-Consistency: generate 3 options, pick majority on ops simplicity |
| Multi-step pipeline bugs | ReAct: observe build output → hypothesize → patch → re-run |
| Hard UX or conversion problems | Least-to-Most: decompose into landing → studio → API → deploy |
| Post-mortem after failed verify | Reflexion: what failed, what rule was violated, what to change |

### Per-iteration prompt template

```
Goal: [one measurable outcome for this iteration]

Let's work step by step:
1. What does the user see/buy?
2. What API/data must exist?
3. What is the smallest change that moves conversion or reliability?
4. What command proves it works?

Then implement. Do not claim done until verification gate passes.
```

---

## Verification gate (mandatory)

Before ANY "done", "shipped", or "working" claim:

1. **IDENTIFY** proof command
2. **RUN** full command (fresh)
3. **READ** exit code + output
4. **VERIFY** claim matches evidence
5. **ONLY THEN** speak or output `BUSINESS_ENGINE_SHIPPED`

| Claim | Proof |
|-------|--------|
| Build OK | `npm run build` → exit 0 |
| Lint OK | `npm run lint` → 0 errors |
| Types OK | `npm run type-check` → exit 0 |
| API OK | `curl localhost:3000/api/health` → `"ok":true` |
| Deploy OK | `vercel ls` or dashboard URL returns 200 |

---

## Vercel Functions rules

- App Router: named exports `GET`, `POST` — no default handlers
- Use `NextRequest` / `NextResponse`; parse query via `new URL(request.url).searchParams`
- No in-process memory as production persistence — use Upstash Redis when `UPSTASH_*` set
- `maxDuration` in `vercel.json` for AI routes (30s default)
- Log errors with `console.error`; never leak `ANTHROPIC_API_KEY`
- Long jobs → future: Vercel Workflow (not in MVP)

---

## React / Next.js rules (high impact)

- Landing `/` as Server Component; studio `/studio` as client island
- `next/dynamic` for heavy studio dashboard
- Parallel fetches in API routes where independent
- `optimizePackageImports` for icon libraries if added
- Metadata + OG in `app/layout.tsx` for sellable SEO

---

## Deployment checklist

1. Env on Vercel: `ANTHROPIC_API_KEY` (required), optional `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
2. Never `NEXT_PUBLIC_` for secrets
3. Preview deploy on PR; prod on merge
4. Regions: `iad1` (see `vercel.json`)

---

## Iteration backlog (priority)

1. ~~Landing + studio split~~
2. ~~Health endpoint~~
3. ~~Pricing page + Gumroad CTA~~
4. Redis-backed graph (optional env)
5. Stripe or Gumroad webhook
6. Auth (Vercel Auth / NextAuth)
7. E2E Playwright smoke
8. Analytics (Vercel Analytics)

---

## Ralph loop usage

See `LOOP.md` in repo root. Re-feed the same prompt until `BUSINESS_ENGINE_SHIPPED` is true.