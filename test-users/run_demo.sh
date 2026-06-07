#!/usr/bin/env bash
# MonadBlitz — End-to-End Demo Shell Script
# Usage: bash test-users/run_demo.sh [PROBLEM]
#
# Submits a query to the orchestrator, polls until SETTLED, and prints results.

set -euo pipefail

BASE_URL="${ORCHESTRATOR_BASE_URL:-http://localhost:8000}"
EXPLORER_BASE="https://testnet.monadexplorer.com/tx"
POLL_INTERVAL=3
MAX_WAIT=180

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

PROBLEM="${1:-Write a gas-optimized Solidity ERC20 transfer function}"

echo ""
echo -e "${BOLD}${CYAN}MonadBlitz Demo${RESET}"
echo -e "${DIM}Decentralized AI Agent Coordination on Monad${RESET}"
echo ""
echo -e "${BOLD}Problem:${RESET} ${PROBLEM}"
echo ""

# ── 1. Health check ────────────────────────────────────────────────────────────

echo -e "${CYAN}→ Checking orchestrator health at ${BASE_URL}...${RESET}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BASE_URL}/health" || echo "000")
if [ "${HTTP_STATUS}" != "200" ]; then
    echo -e "${RED}Orchestrator not reachable (status=${HTTP_STATUS}). Start it first:${RESET}"
    echo "    make orchestrator"
    exit 1
fi
echo -e "${GREEN}✓ Orchestrator is healthy${RESET}"

# ── 2. Submit query ────────────────────────────────────────────────────────────

echo -e "${CYAN}→ Submitting query...${RESET}"
PAYLOAD=$(printf '{"problem": %s, "reward": "0.05"}' "$(echo "${PROBLEM}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip()))')")

RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" \
    "${BASE_URL}/api/queries")

QUERY_ID=$(echo "${RESPONSE}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["id"])' 2>/dev/null || true)
if [ -z "${QUERY_ID}" ]; then
    echo -e "${RED}Failed to create query. Response:${RESET}"
    echo "${RESPONSE}"
    exit 1
fi
echo -e "${GREEN}✓ Query created: ${QUERY_ID}${RESET}"
echo ""

# ── 3. Poll until SETTLED ──────────────────────────────────────────────────────

echo -e "${CYAN}→ Waiting for settlement (max ${MAX_WAIT}s)...${RESET}"
START_TIME=$(date +%s)
LAST_STATUS=""

while true; do
    NOW=$(date +%s)
    ELAPSED=$(( NOW - START_TIME ))

    if [ "${ELAPSED}" -ge "${MAX_WAIT}" ]; then
        echo -e "\n${RED}Timeout after ${MAX_WAIT}s. Query may still be processing.${RESET}"
        echo "Check manually: curl ${BASE_URL}/api/queries/${QUERY_ID}"
        exit 1
    fi

    QUERY_DATA=$(curl -s "${BASE_URL}/api/queries/${QUERY_ID}" 2>/dev/null || echo "{}")
    STATUS=$(echo "${QUERY_DATA}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status","unknown"))' 2>/dev/null || echo "unknown")
    ROUND=$(echo "${QUERY_DATA}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("current_round",1))' 2>/dev/null || echo "1")

    if [ "${STATUS}" != "${LAST_STATUS}" ]; then
        echo -e "  [${ELAPSED}s]  Status: ${BOLD}${STATUS}${RESET}  Round: ${ROUND}"
        LAST_STATUS="${STATUS}"
    fi

    STATUS_UPPER=$(echo "${STATUS}" | tr '[:lower:]' '[:upper:]')
    if [ "${STATUS_UPPER}" = "SETTLED" ] || [ "${STATUS_UPPER}" = "FAILED" ]; then
        break
    fi

    sleep "${POLL_INTERVAL}"
done

echo ""

# ── 4. Fetch memory and print results ─────────────────────────────────────────

MEMORY_DATA=$(curl -s "${BASE_URL}/api/queries/${QUERY_ID}/memory" 2>/dev/null || echo "{}")

WINNER=$(echo "${MEMORY_DATA}" | python3 - <<'EOF'
import json, sys
data = json.load(sys.stdin)
events = data.get("content", {}).get("events", [])
winner_evs = [e for e in events if e.get("type") == "winner"]
if winner_evs:
    w = winner_evs[-1]
    print(f"Address : {w.get('winner_address', 'N/A')}")
    print(f"Score   : {w.get('score', 'N/A')}")
    print(f"Answer  : {str(w.get('answer') or w.get('response', ''))[:400]}")
else:
    print("No winner event found in memory.")
EOF
2>/dev/null || echo "Could not parse memory.")

TX_HASH=$(echo "${QUERY_DATA}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tx_hash",""))' 2>/dev/null || echo "")
MEMORY_HASH=$(echo "${QUERY_DATA}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("memory_hash",""))' 2>/dev/null || echo "")

echo -e "${BOLD}${GREEN}=== Result ===${RESET}"
echo -e "${BOLD}Status:${RESET}      ${STATUS}"
echo -e "${BOLD}Query ID:${RESET}    ${QUERY_ID}"
echo ""
echo "${WINNER}"
echo ""

if [ -n "${MEMORY_HASH}" ]; then
    echo -e "${BOLD}Memory Hash:${RESET} ${MEMORY_HASH}"
fi

if [ -n "${TX_HASH}" ]; then
    echo -e "${BOLD}Tx Hash:${RESET}     ${TX_HASH}"
    EXPLORER_URL="${EXPLORER_BASE}/${TX_HASH}"
    echo -e "${BOLD}Explorer:${RESET}    ${CYAN}${EXPLORER_URL}${RESET}"
    # Open in browser if possible
    if command -v xdg-open &>/dev/null; then
        xdg-open "${EXPLORER_URL}" &>/dev/null &
    elif command -v open &>/dev/null; then
        open "${EXPLORER_URL}" &>/dev/null &
    fi
else
    echo -e "${DIM}(No on-chain tx hash — contracts may not be deployed yet)${RESET}"
fi

echo ""
TOTAL_ELAPSED=$(( $(date +%s) - START_TIME ))
echo -e "${DIM}Total time: ${TOTAL_ELAPSED}s${RESET}"
echo ""
