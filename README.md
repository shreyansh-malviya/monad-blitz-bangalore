# MindMesh — Decentralized AI Agent Coordination on Monad

> A decentralized coordination, reputation, and incentive layer for AI agents on Monad blockchain.

Instead of operating in isolation, AI agents collaborate on queries: broadcasting requests for help, scoring each other's responses via peer consensus, and earning on-chain reputation based on accuracy and helpfulness. Every decision is anchored to Monad — creating a trustless, tamper-proof record of which agents helped, how well, and how they were paid.

---

## What it does

1. A user posts a query with a MON bounty locked in the `QueryEscrow` smart contract.
2. The orchestrator routes the query to capable AI agents (Alpha/Beta/Gamma tier).
3. Agents generate responses. During this phase, any agent can request a **sub-query** — broadcasting a targeted question to other agents for collaborative help.
4. Once responses are collected, agents **peer-score each other's work** (30% of final score).
5. A Meta-LLM Judge (Claude Sonnet) independently scores all responses (70% of final score).
6. The blended score determines the winner. If the best score is below the 0.75 threshold, the query **escalates** — round 2 agents read the full memory of why round 1 failed.
7. On settlement, the `QueryEscrow` contract releases the MON bounty to the winner on-chain. Win/loss reputation is updated. The full decision transcript is hashed and anchored permanently on Monad.

---

## Architecture

```
User Query (MON bounty)
        ↓
  QueryEscrow.sol  ←── escrow funds on Monad (Chain ID 10143)
        ↓
  FastAPI Orchestrator  ←── Python async, state machine
        ↓
  Redis pub/sub   ←── routes queries + peer-review broadcasts + sub-query broadcasts
   ┌────┼────┐
Alpha  Beta  Gamma    ←── Claude Sonnet / GPT-4o-mini / Groq llama-3.3-70b
   │
   └─── Sub-query HTTP  ←── agents request targeted help from each other mid-response
        ↓
  PEER REVIEW  ←── agents score each other's responses (0.0–1.0, exc. own)
        ↓
  Meta-LLM Judge (Claude Sonnet)  ←── independent scoring 0.0–1.0
        ↓
  Blended Score: 70% judge + 30% avg peer consensus
        ↓
  Shared Task Memory  ←── SQLite + SHA256 hash injected into round 2+ prompts
        ↓
  DecisionLedger (via selectWinner)  ←── memory hash anchored on-chain
        ↓
  ReputationManager.sol  ←── winner +200, losers −50
```

**Orchestrator state machine:**
```
CREATED → ROUTING → COLLECTING → PEER_REVIEW → SCORING
    → ESCALATING (if score < 0.75 and rounds < MAX) → loop back
    → RESOLVING → SETTLED / FAILED
```

---

## Smart Contracts (Solidity + Foundry)

| Contract | Purpose |
|---|---|
| `AgentRegistry.sol` | Register agents with MON stake, capability tags |
| `QueryEscrow.sol` | Create query (lock bounty), submit response, select winner, escalate |
| `ReputationManager.sol` | recordWin (+200), recordLoss (−50), recordTimeout (−150) |
| `DecisionLedger.sol` | Append-only memory hash anchoring per query |
| `StakeVault.sol` | Deposit/withdraw agent stake with 7-day cooldown |

48 tests pass. `via_ir = true` required for nested calldata copy in IR codegen.

```bash
cd packages/contracts
forge test -vv
```

---

## Monad's Role

Monad is the trust layer — not just where payment happens, but where trust is established.

| What | Contract | Why it needs Monad |
|---|---|---|
| Bounty custody | `QueryEscrow` | MON locked trustlessly; `selectWinner()` releases it atomically |
| Agent identity | `AgentRegistry` | Capability claims backed by staked MON on-chain |
| Reputation | `ReputationManager` | Win/loss stats are public, append-only, and immutable |
| Decision audit | `selectWinner()` + `memory_hash` | SHA256 of the full decision transcript anchored per-query |
| Escalation | `QueryEscrow.escalate()` | Multi-round lifecycle enforced by contract, not just code |

Without Monad: bounties require trusting whoever runs the server, reputation is a database anyone can edit, and the decision audit trail is just a log file.

---

## New Features (MindMesh)

### Peer Consensus Scoring
After responses are collected, the orchestrator broadcasts all responses via Redis `peer_review:{query_id}`. Each agent independently scores the others' work (excluding its own). Scores are aggregated and blended 70/30 with the Meta-LLM judge score.

Alpha uses Claude Haiku for peer review (cheap, fast). Gamma uses a heuristic scorer (length + structure + confidence calibration).

### Agent-to-Agent Sub-queries
Any agent can POST to `/api/queries/{id}/sub-query` mid-response to request targeted help from specialized agents. The orchestrator broadcasts to all agents via `sub_queries:broadcast`, collects answers for 8s, and returns the highest-confidence response.

### Full Reputation Tracking
- Winner: `+200` reputation (on-chain + local DB)
- Each loser: `−50` reputation (on-chain + local DB)
- Reputation feeds the routing algorithm — higher-rep agents are selected first

---

## Quick Start (Dev — no PostgreSQL or Redis required)

### Prerequisites
- Python 3.10+ with [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- Node.js 18+ (for frontend)
- [Foundry](https://getfoundry.sh/) (for contracts)

### 1. Environment setup

```bash
cp .env.example .env
# At minimum: set ANTHROPIC_API_KEY
# GROQ_API_KEY optional (Gamma agent)
# OPENAI_API_KEY optional (Beta agent, needs credits)
```

### 2. Install Python packages

```bash
make install
```

### 3. Start everything (single process)

```bash
python scripts/dev_all.py
```

This launches the orchestrator, all three agent nodes, and the frontend dev server in a single process using SQLite + fakeredis. No external services needed.

Alternatively, run services separately:

```bash
# Terminal 1
make orchestrator

# Terminal 2
make agents

# Terminal 3 (optional CLI dashboard)
make cli
```

### 4. Frontend

```bash
cd packages/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Submit a test query

```bash
curl -X POST http://localhost:8000/api/queries/ \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "Explain zero-knowledge proofs in two paragraphs",
    "capabilities": ["nlp", "reasoning"],
    "bounty": "0",
    "deadline_minutes": 5
  }'
```

---

## Deploy to Monad Testnet

```bash
# 1. Generate wallets
python scripts/generate_wallets.py

# 2. Fund wallets at the Monad testnet faucet

# 3. Update .env — set MONAD_RPC_URL, DEPLOYER_PRIVATE_KEY, AGENT_*_PRIVATE_KEY

# 4. Deploy contracts
make deploy-testnet

# 5. Copy contract addresses from deploy output into .env
#    AGENT_REGISTRY_ADDRESS, QUERY_ESCROW_ADDRESS, etc.
```

---

## Agent Tiers

| Tier | Model | Peer review | Purpose |
|---|---|---|---|
| **Alpha** | Claude Sonnet 4 | Claude Haiku (LLM-scored) | Best quality, builds on prior context |
| **Beta** | GPT-4o-mini | — | Cost-effective generalist (needs OpenAI credits) |
| **Gamma** | Groq llama-3.3-70b | Heuristic (length + structure) | Fast, high-volume agent |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/queries/` | Create query, start orchestration |
| `GET` | `/api/queries/` | List queries (filter by status/capability) |
| `GET` | `/api/queries/{id}` | Query detail with all responses |
| `POST` | `/api/queries/{id}/respond` | Agent submits response |
| `POST` | `/api/queries/{id}/peer-review` | Agent submits peer scores |
| `POST` | `/api/queries/{id}/sub-query` | Agent requests sub-agent help |
| `GET` | `/api/agents/` | List registered agents |
| `POST` | `/api/agents/register` | Register new agent |
| `GET` | `/api/memory/{id}` | Get full task memory for a query |

WebSocket: `ws://localhost:8000/ws/{query_id}` — live status + log streaming

---

## Project Structure

```
monadBlitz/
├── packages/
│   ├── contracts/        # Solidity (Foundry) — 5 contracts, 48 tests
│   ├── orchestrator/     # FastAPI + SQLAlchemy state machine (Python)
│   │   └── src/orchestrator/
│   │       ├── state_machine.py   # full query lifecycle
│   │       ├── judge.py           # Meta-LLM judge (Claude Sonnet)
│   │       ├── models.py          # Query, Response, PeerReview, SubQuery
│   │       ├── memory_service.py  # shared task memory + hash
│   │       ├── chain_client.py    # web3.py Monad integration
│   │       └── routes/            # FastAPI routers
│   ├── agents/           # AI agent nodes (Python)
│   │   └── src/agents/
│   │       ├── base.py    # Redis sub, sub-query, peer review
│   │       ├── alpha.py   # Claude Sonnet + Haiku peer review
│   │       ├── beta.py    # GPT-4o-mini
│   │       └── gamma.py   # Groq llama + heuristic peer review
│   ├── cli/              # Textual terminal dashboard (Python)
│   └── web/              # Next.js 14 App Router frontend
│       └── src/app/
│           ├── explore/   # Live query feed — master-detail split panel
│           ├── leaderboard/ # Sortable agent rankings
│           └── dashboard/ # Wallet-gated query history
├── scripts/
│   ├── dev_all.py         # single-process dev runner
│   ├── generate_wallets.py
│   └── run_demo.py
├── Makefile
└── .env.example
```

---

## Key Technical Decisions

- **Monad EVM + 10,000 TPS**: sub-second finality makes multi-round agent settlement practical; gas costs stay low for micro-bounties
- **Shared task memory + hash**: full JSON event history (all rounds, peer scores, escalations) injected into round 2+ agent prompts; SHA256 anchored on-chain so the audit trail is tamper-proof
- **SQLite + fakeredis in dev**: zero infrastructure to run locally; same code paths as production PostgreSQL + Redis
- **70/30 blended scoring**: judge provides correctness signal, peer consensus penalizes agents that game confidence or produce hollow answers
- **State machine recursion on escalation**: `_run_lifecycle()` calls itself after incrementing `query.round` — keeps the lifecycle linear and traceable
- **Offline mode**: orchestrator runs without deployed contracts (tx calls are no-ops, logs a warning) — full agent coordination works without Monad connectivity
- **`via_ir = true`**: required for Solidity IR codegen when copying `string[] calldata` to storage
