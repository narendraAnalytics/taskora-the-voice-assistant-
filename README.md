# Taskora

**Your interns speak. The board updates.**

Taskora is a voice-first work coordinator for internship programs and small teams. Interns give a
20-second update in Telugu, Hindi, English or a mix of them. Organizers ask "who's behind?" and hear
the answer aloud. Taskora turns what people say into task changes and confirms before it changes
anything.

> Status: early development. The landing page is built; the MVP is in progress.

---

## Why

- Organizers spend hours chasing updates over calls and chats.
- Interns forget to update the board, so status is always stale.
- Blockers come to light days late.
- Speaking for 20 seconds is easier than typing, especially in your own language.

Existing voice tools mostly turn speech into a task. Taskora is a two-way assistant that answers,
asks clarifying questions and acts, built for the people who run intern batches: colleges,
training institutes, bootcamps and small agencies.

## What you can say

| Who | Says | Taskora does |
| --- | --- | --- |
| Organizer | "ఇవాళ pending tasks ఏంటి?" (What's pending today?) | Reads pending tasks by intern, overdue first |
| Organizer | "Ravi కి login page task assign చెయ్యి, deadline Thursday" | Asks which Ravi, then assigns after confirmation and emails him |
| Organizer | "Move all of Sneha's tasks by two days" | Shows every date that will change, applies on confirm |
| Organizer | "Who is blocked?" | Lists blockers, who raised them and since when |
| Intern | "నా tasks ఏంటి ఇవాళ?" (What are my tasks today?) | Reads today's tasks and deadlines |
| Intern | "Login page done, API 50 percent, design కోసం waiting" | Marks done, updates progress, logs a blocker, alerts the organizer |
| Automatic | 6 pm every day | Organizer summary: done, pending, blocked, who didn't update |

## How a command works

```
 Speak ──► Transcribe ──► Understand ──► Confirm ──► Update + reply
  mic      Sarvam          Gemini         confirm      board refreshes,
           saaras:v3       intent JSON    card for     answer spoken with
           (codemix)       + name match   changes      Sarvam bulbul:v3
```

Read-only questions skip the confirm card and go straight to a spoken answer.

## Safety rules

- Reassignments and bulk changes always show a confirm card.
- Similar names ("Ravi" and "Ravi K") get a question, never a guess.
- Interns can only change their own tasks, enforced on the server.
- Every change is recorded as an event, so actions can be undone and every task has a full history.
- Audio is deleted after 30 days; transcripts are kept.

## Modules

| # | Module | Phase |
| --- | --- | --- |
| 1 | Voice assistant: push-to-talk, live transcript, intent, confirm card, spoken reply, undo | MVP |
| 2 | Tasks: create, assign, reassign, deadlines, priority, status | MVP |
| 3 | Team and roles: organizer, intern, admin; workload per person | MVP |
| 4 | Voice standups: daily spoken update → tasks updated, blockers logged | MVP |
| 5 | Dashboard: board, overdue list, per-intern progress, filters | MVP |
| 6 | Notifications: assignment emails, reminders, daily summary | Phase 2 |
| 7 | Reach out: call links, later an AI phone agent | Phase 3 |
| 8 | Program tools: attendance, reports, evaluations, certificates | Phase 4 |

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, installable PWA |
| Speech-to-text | [Sarvam](https://docs.sarvam.ai) `saaras:v3` (REST), `saaras:v3-realtime` (WebSocket) for live mode |
| Text-to-speech | Sarvam `bulbul:v3` |
| Intent and reasoning | Gemini Flash-Lite (strict JSON) and Gemini Pro (summaries) |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Clerk organizations with organizer / intern / admin roles |
| Background jobs | Inngest |
| Email | Resend + React Email |
| Quality | Vitest, Playwright, multilingual voice-command eval set, Langfuse, Sentry |
| Hosting | Vercel |

## Project structure

```
taskora/
├── frontend/          Next.js app
│   └── src/
│       ├── app/                 routes, layout, global styles
│       ├── components/landing/  landing page (voice demo, commands, logo)
│       ├── components/ui/       shadcn/ui components
│       ├── hooks/
│       └── lib/
└── README.md
```

## Getting started

Requirements: Node.js 20+ and pnpm.

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:3000
```

Production build:

```bash
pnpm build
pnpm start
```

Environment variables go in `frontend/.env.local` (never committed). They will be needed as the
MVP features land:

```bash
SARVAM_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## Roadmap

- [x] **Phase 0 — Foundation:** Next.js app, design system, landing page
- [ ] **Phase 1 — MVP (weeks 1–4):** voice assistant, tasks, roles, voice standups, dashboard
- [ ] **Phase 2 — Reliability (weeks 5–7):** eval set and accuracy numbers, tests in CI, email reminders, GitHub sync
- [ ] **Phase 3 — Differentiate (weeks 8–10):** live "Jarvis" voice mode, realtime board, MCP server
- [ ] **Phase 4 — Launch (weeks 11–12):** internship program kit, billing, pilots with three programs

## Pricing (pilot, proposed)

| Plan | Price | Includes |
| --- | --- | --- |
| Free | ₹0 | 1 team, up to 8 members, voice tasks and standups |
| Team | ₹499 / month | Up to 25 members, summaries, email reminders, GitHub sync |
| Program | ₹1,999 / month per batch | Up to 100 interns, attendance, evaluations, certificates, reports |

## Design

A warm Indian palette with no white, black or blue: neem green, haldi yellow, saffron, marigold
paper, tulsi green and kumkum red. Type is set in Anek Telugu (display, with Telugu script) and
Mukta (body, with Devanagari), both from Google Fonts.

## Acknowledgements

Speech recognition and synthesis by [Sarvam AI](https://www.sarvam.ai).
