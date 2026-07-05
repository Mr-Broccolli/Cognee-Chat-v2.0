<p align="center">
  <img src="https://img.shields.io/badge/build-passing-brightgreen.svg?style=flat-square" alt="build passing" />
  <img src="https://img.shields.io/github/license/saltstack/salt" alt="Apache-2.0 License" />
  <img src="https://img.shields.io/badge/Next.js-14-black.svg?style=flat-square&logo=nextdotjs" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/FastAPI-teal.svg?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/SQLite-blue.svg?style=flat-square&logo=sqlite" alt="SQLite" />
</p>

<h1 align="center">Cognee Chat</h1>
<p align="center">
  <strong>Visually traceable AI reasoning powered by <a href="https://github.com/topoteretes/cognee">Cognee</a>, React Flow, and FastAPI.</strong><br/>
  Think beyond vector search — build persistent, multi‑hop knowledge graphs that remember.
</p>

---

## Architecture

```
┌────────────────────────┐
│  User                  │
│  (Next.js 14 Browser)  │
└───────────┬────────────┘
            │  HTTP (rewrites)
            ▼
┌──────────────────────────┐
│  Next.js 14 App Router   │
│  • Tailwind / Shadcn UI  │
│  • React Flow mind map   │
│  • Prisma ORM client     │
└───────────┬──────────────┘
            │  /api/* rewrites → http://127.0.0.1:8001
            ▼
┌──────────────────────────┐
│  FastAPI Backend         │
│  • /chat – graph recall  │
│  • /ingest – text & file │
│  • /graph/visualize      │
│  • /generate-title       │
└───────────┬──────────────┘
            │  cognee SDK
            ▼
┌──────────────────────────┐
│  Cognee Engine           │
│  • Graph construction    │
│  • Embedding & storage   │
│  • Memory persistence    │
└───────────┬──────────────┘
            │  SQL via Prisma
            ▼
┌──────────────────────────┐
│  SQLite                  │
│  (session + chat history)│
└──────────────────────────┘
```

---

## Features

### Frontend
- **Glassmorphism dark UI** — `bg-[#0B0F19]` with Shadcn UI components, Framer Motion animations, and Inter font
- **Live knowledge‑graph visualization** — React Flow with custom node types, glowing borders, and real‑time diff animations for new nodes/edges
- **Visual source traceability** — click a source badge to pan‑zoom‑flash the corresponding graph node
- **Network edge‑weight pruning** — confidence‑threshold slider (0.0–1.0) instantly filters edges, decluttering the graph
- **Dynamic schema builder** — define entity types and relationships on‑the‑fly; localStorage‑persisted, passed to ingest APIs
- **Drag‑and‑drop file ingest** — fallback to direct backend URL if multipart rewrites fail
- **Shadcn DropdownMenu** — Rename / Delete per session via three‑dots menu, with Prisma‑backed server actions
- **Smart auto‑renaming** — LLM‑generated 2‑3‑word titles fire right after the first message; sidebar stays clean

### Backend (FastAPI + Cognee)
- **`POST /chat`** — graph‑aware recall → LLM generation with source‑node traceability
- **`POST /ingest/text`** & **`POST /ingest/file`** — accept text/files, pass as data to `cognee.remember()`
- **`GET /graph/visualize`** — returns nodes + edges with confidence weights extracted from edge metadata
- **`POST /generate-title`** — lightweight LLM call to produce a short chat title
- **`DELETE /reset`** — wipe the knowledge graph entirely
- **Edge weight extraction** — reads `weight`/`score`/`confidence` from Cognee edge dictionaries; defaults to 0.5

---

## Directory Structure

```
Cognee-Chat-v2.0/
├── .env                      # LLM keys + backend config (gitignored)
├── .env.example              # Template with placeholder values
├── .gitignore
├── README.md
├── LICENSE
├── requirements.txt          # Python deps (FastAPI, Cognee, LiteLLM, …)
├── api.py                    # FastAPI application entry point
├── start_backend.py          # Uvicorn launcher (writes .port)
│
├── app/                      # Next.js 16 App Router
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   │
│   ├── lib/
│   │   ├── api.ts            # API client (cached base URL)
│   │   └── db.ts             # better-sqlite3 session CRUD
│   │
│   ├── app/
│   │   ├── globals.css       # CSS custom properties, theme vars
│   │   ├── layout.tsx        # root layout (sidebar + content)
│   │   ├── page.tsx          # homepage (redirects to /chat)
│   │   ├── sidebar.tsx       # nav + session list + graph stats
│   │   ├── favicon.ico
│   │   ├── chat/page.tsx     # chat interface
│   │   ├── graph/page.tsx    # React Flow graph visualization
│   │   ├── ingest/page.tsx   # text/file ingest + reset
│   │   ├── settings/page.tsx # model picker, theme toggle, status
│   │   └── api/
│   │       ├── port/route.ts
│   │       └── sessions/
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   │
│   ├── public/
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   │
│   └── data/
│       └── cognee.db        # SQLite (auto-created, gitignored)
│
└── venv/                     # Python virtual env (gitignored)
```

---

## Local Setup

### 0. Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10

### 1. Clone & Environment

```bash
git clone https://github.com/Mr-Broccolli/Cognee-Chat-v2.0.git
cd Cognee-Chat-v2.0
```

### 2. Backend

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows
source venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
python start_backend.py
```

### 3. Frontend

```bash
cd app
npm install
npm run dev                  # http://localhost:3000
```

The frontend discovers the backend port automatically via the `.port` file.

### 4. Smoke Test

1. Open `http://localhost:3000`.
2. Click **Ingest** → paste a paragraph → hit *Ingest Text*.
3. Switch to **Mind Map** — you should see nodes and edges.
4. Go back to **Chat** → ask a question about what you ingested.
5. Click a source badge under the AI reply — the mind map will pan‑zoom and flash the referenced node.

---

## Tech Stack

| Layer    | Technology                                          |
|----------|-----------------------------------------------------|
| UI       | Next.js 14, Tailwind CSS, Shadcn UI, Framer Motion  |
| Graph    | React Flow 11                                       |
| ORM      | Prisma 5 (SQLite)                                   |
| Backend  | FastAPI, Uvicorn                                    |
| RAG      | Cognee (open‑source graph‑RAG memory platform)      |
| LLM      | LiteLLM (OpenRouter → Meta Llama 3.1)               |
| Embed    | FastEmbed (BAAI/bge‑small‑en‑v1.5)                  |
| DB       | SQLite                                              |

---

## License
Apache 2.0 — see [LICENSE](LICENSE).

---

<p align="center">
  Built for <strong>The Hangover Hackathon</strong>
</p>
