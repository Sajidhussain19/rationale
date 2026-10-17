# Rationale — the decision memory for teams

> **Never lose the *why*.** Rationale turns meetings, recordings, chats and docs into a living **Decision Ledger**, and its **Conflict Radar** warns you the moment a new decision contradicts an old one.

**Track:** Future of Work & Enterprise Productivity — AI Builder Cup 2026 · Team *The Dark Horses*

## The problem
Teams make hundreds of decisions in meetings and chats, then forget *why*. The result: the same debates repeat, new hires lack context, and new decisions silently contradict old ones (e.g. Sales promises an on-prem install the CTO ruled out a month ago).

## What it does
1. **Capture** — paste a transcript or upload an **audio/video recording, PDF or text file**. Gemini processes audio natively (no separate speech-to-text).
2. **Extract** — Gemini returns structured decisions: statement, **rationale**, rejected alternatives, owner, verbatim quote, tags.
3. **Conflict Radar** — every new decision is reasoned against the full decision history and classified as *contradicts / supersedes / refines*. Contradicted decisions are flagged **disputed** until a human resolves them.
4. **Ask why** — natural-language Q&A over the ledger with clickable citations (`[D-3]`).
5. **Resolve** — accept the new decision or keep the original; the ledger keeps full history.

## Google Cloud architecture
| Component | How we use it |
|---|---|
| **Gemini** (Vertex AI / Gemini API) | Multimodal ingestion (audio, PDF, text), structured JSON extraction via response schemas, cross-document contradiction reasoning, cited Q&A |
| **Firebase** (Admin SDK) | Server-side access to Firebase services from Cloud Run with service-account auth — no secrets in code |
| **Cloud Firestore** | Per-workspace `sources`, `decisions` and `conflicts` collections; atomic batched writes keep ledger + conflict state consistent |
| **Cloud Run** | Containerised Next.js 15 app (UI + API routes), autoscaling, min-instance 1 for zero cold-start demos |

```
Browser (Next.js UI)
   │  upload / ask
   ▼
Cloud Run ── Next.js API routes ──► Gemini (extract + reason + answer)
   │
   └──► Firebase Admin SDK ──► Cloud Firestore (workspaces/{id}/sources|decisions|conflicts)
```

## Run locally
```bash
npm install
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=<your-project>
export GEMINI_API_KEY=<optional: AI Studio key; otherwise Vertex AI is used>
npm run dev
```

## Deploy (Cloud Shell)
```bash
./deploy.sh          # enables APIs, creates Firestore, grants IAM, deploys to Cloud Run
```

## Demo script
1. **Load demo workspace** → 6 decisions from 2 past meetings of a fintech startup.
2. The *Enterprise Deal Debrief* transcript is pre-filled → **Extract decisions & check conflicts**.
3. Conflict Radar flags: on-prem deal **contradicts** D-2 "SaaS-only, no on-prem"; enterprise billing **refines** the freemium decision.
4. Ask: *"Are we allowed to do on-prem deployments?"* → cited answer.
5. Resolve the conflict.

## Roadmap
Slack / Google Meet / Drive connectors · Firestore vector search for 10k+ decision ledgers · weekly "decision drift" digest · role-based workspaces with Firebase Auth.
