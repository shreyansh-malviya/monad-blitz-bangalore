# Wallet & Credential Setup

## 1. Generate agent wallets

Run the built-in wallet generator. It creates four fresh Ethereum key pairs:
```bash
cd d:/Hackathons/monadBlitz
python scripts/generate_wallets.py
```
Copy the four private keys it prints into `.env`:

```env
DEPLOYER_PRIVATE_KEY=0x<your key>
ALPHA_PRIVATE_KEY=0x<your key>
BETA_PRIVATE_KEY=0x<your key>
GAMMA_PRIVATE_KEY=0x<your key>
```

> **Why four wallets?**  
> `DEPLOYER` deploys the smart contracts. The three agent wallets are the identities each AI agent uses to sign bids, submit responses, and receive bounty rewards on-chain.

---

## 2. Get testnet MON

Monad testnet faucet options:

| Source | URL / method |
|--------|-------------|
| **Contract.dev faucet** | https://contract.dev — connect wallet → request MON |
| **Monad official faucet** | https://faucet.monad.xyz — paste address → receive 0.5 MON |
| **Discord faucet** | Monad Discord → `#testnet-faucet` channel → `!faucet 0x<address>` |

**Which addresses to fund:**

| Wallet | Minimum needed | Purpose |
|--------|---------------|---------|
| `DEPLOYER` | 0.1 MON | Contract deployment gas |
| `ALPHA` | 0.01 MON | Transaction signing (staking, claim rewards) |
| `BETA` | 0.01 MON | Same as above |
| `GAMMA` | 0.01 MON | Same as above |

Fund `DEPLOYER` first — you need it to deploy contracts before agents can register.

---

## 3. Where credentials live

All keys go in the root `.env` file at `d:/Hackathons/monadBlitz/.env`.  
The file is already git-ignored. **Never commit it.**

```
d:/Hackathons/monadBlitz/
├── .env              ← put your real keys here (git-ignored)
├── .env.example      ← template showing all supported variables
└── WALLET_SETUP.md   ← this file
```

### Key sections in `.env`

```env
# ── LLM providers (already filled if you have the keys)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...

# ── Wallets (fill after generating)
DEPLOYER_PRIVATE_KEY=0x...
ALPHA_PRIVATE_KEY=0x...
BETA_PRIVATE_KEY=0x...
GAMMA_PRIVATE_KEY=0x...

# ── Contract addresses (fill after running deploy)
AGENT_REGISTRY_ADDRESS=0x...
QUERY_ESCROW_ADDRESS=0x...
REPUTATION_MANAGER_ADDRESS=0x...
PROPOSAL_ESCROW_ADDRESS=0x...

# ── Optional: IPFS upload via Pinata (reports work offline without this)
PINATA_JWT=ey...

# ── Multi-machine networking (leave blank for single-machine local mode)
NODE_MODE=local
NODE_ENDPOINT=http://192.168.x.x:8000
BOOTSTRAP_NODES=http://192.168.x.x:8000,http://192.168.x.y:8000
```

---

## 4. Deploy contracts

After adding `DEPLOYER_PRIVATE_KEY` and funding that address:

```bash
# Windows
cd d:/Hackathons/monadBlitz/packages/contracts

C:\Users\shrey\.foundry\bin\forge.exe script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# The script prints deployed addresses — copy them into .env
```

After deployment, paste the printed addresses into `.env`:
```env
AGENT_REGISTRY_ADDRESS=0x<printed>
QUERY_ESCROW_ADDRESS=0x<printed>
REPUTATION_MANAGER_ADDRESS=0x<printed>
PROPOSAL_ESCROW_ADDRESS=0x<printed>
```

---

## 5. Run the system

```bash
# Single machine (3 agents + orchestrator + frontend)
python dev_all.py

# Network mode (second machine joins via WiFi)
# On machine 1 (orchestrator + agents):
NODE_MODE=network NODE_ENDPOINT=http://192.168.1.10:8000 python dev_all.py

# On machine 2 (extra agents only):
NODE_MODE=network NODE_ENDPOINT=http://192.168.1.20:8001 \
BOOTSTRAP_NODES=http://192.168.1.10:8000 python dev_all.py --agents-only
```

---

## 6. Verify everything is working

```bash
# Check orchestrator health
curl http://localhost:8000/health

# Expected output includes:
# "node_mode": "local",
# "ipfs_available": false,   ← fine without Pinata
# "proposal_contracts_deployed": false  ← fine without on-chain deploy
```

The system works fully in **offline/local mode** without Pinata or contract deployment — IPFS uses a deterministic hash stub and contract calls are skipped gracefully.
