# Life Lanes

Life Lanes is a calm, local-first board for turning brain dumps into a focused life map.

It is built for the moments when priorities are scattered across work, money, health, learning, admin, ideas, and everything in between. Capture what is on your mind, sort it into the right life area, and keep a clear view of what is active, parked, or complete.

No account. No cloud. No team workspace. No productivity-bro noise.

## The Idea

Life Lanes has three focused spaces:

- **Brain Dump**: capture loose thoughts quickly before they become mental clutter.
- **My Life Lanes**: a compact personal board for active priorities.
- **Achievements**: a lightweight record of what has moved through.

The board uses simple states such as Doing, To Do, and Parked. Inside each state, items group into Life Lanes such as Career, Fitness, Finance, Creative, Health, Social, Travel, and Ideas.

That makes it feel less like a task manager and more like a personal source of truth.

## Guided Demo

The Demo board includes a guided walkthrough that shows the intended flow:

1. Three separate Brain Dump notes appear:
   - Career: complete a project management certification
   - Fitness: build a 3-day gym routine
   - Finance: save £500 for a holiday fund
2. The highlighted Capture button moves them into Triage.
3. The highlighted Sort button places them into the right Life Lanes automatically.
4. The board demonstrates custom lanes, grouped cards, movement between states, and Achievements.

The demo is manual, so users stay in control while the app shows what to press next.

## Features

- Fast Brain Dump capture
- Manual triage from notes into board items
- Demo-guided sorting into Career, Fitness, and Finance examples
- Compact board with Life Lane sub-lanes inside each state
- Rename, add, and delete board lanes
- Rename, add, and delete Life Lane tags
- Drag-and-drop card movement with mobile-safe controls
- Date ranges for longer-running goals
- Item detail view with context across lanes
- Separate Achievements view for completed items
- Demo board and blank personal board
- Local browser persistence
- Installable app metadata and offline shell

## Default Life Lanes

Life Lanes starts with a balanced set of tags:

- Lifestyle
- Career
- Fitness
- Finance
- Upskilling
- Social
- Adventure
- Health
- Creative
- Home
- Life Admin
- Relationships
- Travel
- Ideas

You can rename, remove, or add your own.

## Privacy

Life Lanes is local-first.

Your data is stored in your browser using local storage. There is no backend, no authentication, no database, no analytics, no payments, and no AI API.

## Run Locally

```bash
npm install
npm run dev
```

Build and typecheck:

```bash
npm run build
```

Run the TypeScript lint check:

```bash
npm run lint
```

## Tech

- React
- TypeScript
- Vite
- Local storage
- Plain CSS
- PWA manifest and service worker shell

## Status

Life Lanes is an early product prototype focused on a polished core experience: capture, triage, life-area grouping, calm board movement, and a guided demo that makes the workflow obvious.
