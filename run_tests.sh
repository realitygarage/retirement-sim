#!/usr/bin/env bash
# run_tests.sh -- Git Bash test runner for retirement-sim
# Starts Vite dev server, runs Playwright, then shuts Vite down.
# Usage: bash run_tests.sh

set -euo pipefail

cd "$(dirname "$0")"
mkdir -p test-results

LOG="test-results/test-run.txt"
VITE_PORT=5173
VITE_PID=""

cleanup() {
  if [[ -n "$VITE_PID" ]]; then
    echo "" | tee -a "$LOG"
    echo "Stopping Vite (pid $VITE_PID)..." | tee -a "$LOG"
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Start Vite ────────────────────────────────────────────────────────────────
echo "Starting Vite dev server on port $VITE_PORT..."
npx vite --port "$VITE_PORT" &
VITE_PID=$!

# Wait until Vite is accepting connections (up to 30s)
echo -n "Waiting for Vite"
for i in $(seq 1 30); do
  if curl -s --max-time 1 "http://localhost:$VITE_PORT" > /dev/null 2>&1; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo ""
    echo "ERROR: Vite did not start within 30 seconds." >&2
    exit 1
  fi
done

# ── Run Playwright ─────────────────────────────────────────────────────────────
{
  echo "=== Test run: $(date) ==="
  echo ""
  npx playwright test retirement-simulator.spec.js --reporter=list --headed 2>&1
  echo ""
  echo "=== Done: $(date) ==="
} | tee "$LOG"
