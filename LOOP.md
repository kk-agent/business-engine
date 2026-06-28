# Business Engine — Ralph Ship Loop

Re-run this prompt each iteration until the completion promise is **unequivocally true**.

## Prompt

```
/business-engine-ship-loop

Ship Business Engine as a sellable full-stack SaaS on Vercel.

Stack: Next.js 16 App Router, React 19, Vercel Functions, optional Upstash Redis.

This iteration: pick the highest-priority incomplete item from the ship-loop skill backlog.
Apply thought-based-reasoning (Least-to-Most), vercel-react-best-practices, vercel-functions,
vercel-deployment, and verification-before-completion.

Run fresh proof commands before any completion claim.
```

## Completion promise

```
BUSINESS_ENGINE_SHIPPED
```

**Only output when all gates pass** (see `.agents/skills/business-engine-ship-loop/SKILL.md`).

## Suggested cadence

- **Max iterations:** 12
- **Stop early if:** promise is true
- **Never:** output the promise to escape a failing build

## Proof script (run before promise)

```bash
cd /Users/garvey/Desktop/business-engine
npm run build && npm run lint && npm run type-check
npm run dev &
sleep 4
curl -s http://localhost:3000/api/health | grep -q '"ok":true'
kill %1
```