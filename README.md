# MonadBlitz — Decentralized AI Agent Coordination on Monad

> **Hackathon Project** — AI agent reputation marketplace built on Monad blockchain.

Agents compete to answer queries. A Meta-LLM judge scores quality. Winners earn on-chain reputation. All anchored to Monad.

---

## Architecture

```
User Query (MON bounty)
        ↓
  QueryEscrow.sol  ←── escrow funds on Monad (Chain ID 10143)
        ↓
  FastAPI Orchestrator  ←── Python, async, state machine
        ↓
  Redis pub/sub   ←── notifies agent nodes
   ┌────┼────┐
Alpha  Beta  Gamma    ←── Claude / GPT-4o-mini / Groq llama
        ↓
  Meta-LLM Judge (Claude Sonnet)   ←── scores 0.0–1.0
        ↓
  Shared Task Memory  ←── PostgreSQL + keccak256 hash
        ↓
  DecisionLedger.sol  ←── memory hash anchored on-chain
        ↓
  ReputationManager.sol  ←── win/loss reputation delta
```

**Orchestrator state machine:** `CREATED → ROUTING → COLLECTING → SCORING → (ESCALATING loop) → RESOLVING → SETTLED`

If the best score < 0.75 and rounds < MAX_ROUNDS, escalates to next round. Round 2+ agents see the full memory of why round 1 failed.

---

## Smart Contracts (Solidity + Foundry)

| Contract | Purpose |
|---|---|
| `AgentRegistry.sol` | Register agents with stake, capability tags, reputation init |
| `QueryEscrow.sol` | Create query (escrow MON), submit response, select winner |
| `ReputationManager.sol` | recordWin (+200), recordLoss (−50), recordTimeout (−150) |
| `DecisionLedger.sol` | Append-only memory hash anchoring per query |
| `StakeVault.sol` | Deposit/withdraw stake with 7-day cooldown |

**48 tests pass.** `via_ir = true` required for nested calldata copy in IR codegen.

```bash
cd packages/contracts
forge test -vv
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- PostgreSQL 14+
- Redis 7+
- Node.js 18+ (for frontend)
- [Foundry](https://getfoundry.sh/) (for contracts)

### 1. Environment Setup

```bash
cp .env.example .env
# Fill in API keys and wallet private keys
python scripts/generate_wallets.py  # generates wallets.json
```

### 2. Install Python packages

```bash
make install
```

### 3. Start Services (local)

Terminal 1 — Orchestrator:
```bash
make orchestrator
```

Terminal 2 — Agent nodes:
```bash
make agents
```

Terminal 3 — CLI dashboard:
```bash
make cli
```

Terminal 4 — Web frontend:
```bash
cd packages/web && npm install && make web
```

### 4. Run Demo

```bash
make demo
```

### 5. Docker (all-in-one)

```bash
make docker-up
```

---

## Deploy to Monad Testnet

```bash
# 1. Generate wallets and fund them at the Monad testnet faucet
python scripts/generate_wallets.py

# 2. Update .env with wallet private keys and confirm MONAD_RPC_URL

# 3. Deploy contracts
make deploy-testnet

# 4. Copy contract addresses from deploy output into .env
```

---

## Agent Tiers

| Tier | Model | Quality | Purpose |
|---|---|---|---|
| **Alpha** | Claude Sonnet | High | Best quality, builds on prior context |
| **Beta** | GPT-4o-mini | Medium | Cost-effective generalist |
| **Gamma** | Groq llama-3.3-70b | Lower | Fast, intentionally lower quality for demo contrast |

---

## Project Structure

```
monadBlitz/
├── packages/
│   ├── contracts/        # Solidity contracts + Foundry tests
│   ├── orchestrator/     # FastAPI orchestrator (Python)
│   ├── agents/           # AI agent nodes (Python)
│   ├── cli/              # Textual terminal dashboard (Python)
│   └── web/              # Next.js 14 frontend
├── scripts/
│   ├── generate_wallets.py
│   └── run_demo.py
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Key Technical Decisions

- **Monad blockchain**: EVM-compatible L1 with 10,000+ TPS enables micro-payment gas economics
- **Shared task memory**: full JSON event history stored in PostgreSQL, keccak256 hash anchored on-chain — injected into agent prompts so round 2 agents see why round 1 failed
- **Meta-LLM judge**: Claude Sonnet evaluates all responses 0.0–1.0 with reasoning, driving escalation
- **via_ir = true**: required for Solidity IR codegen when using `string[] calldata` parameters with storage copies
- **pydantic-settings**: handles dotted .env key names via `validation_alias`
- **Offline mode**: orchestrator runs gracefully without deployed contracts (uses zero hashes, logs warning)
