#!/usr/bin/env bash
# NeuroSecure / One Shield launcher — Capital One sandbox (cof) edition.
#
# Defaults here assume the cof environment: the One Shield LangGraph agent
# routes every evaluation, and all LLM calls go through the sandbox client
# (create_chat_openai_model, model llama-4-scout — base_url/api_key are the
# sandbox's business, never ours). Every default can be overridden via env.
#
# Usage:  ./run.sh              (build UI if node present, then start :8000)
#         ./run.sh --skip-build (start only — frontend/dist already built)
set -euo pipefail
cd "$(dirname "$0")"

# --- cof defaults (override by exporting before running) -------------------
# ONE evaluation path: the One Shield agent via the sandbox client.
# No URLs, no api keys, anywhere.
export ONESHIELD_LOG="${ONESHIELD_LOG:-1}"              # live console log
export PYTHONIOENCODING=utf-8

echo "Mode: One Shield agent via the sandbox client"

if [[ "${1:-}" != "--skip-build" ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Building frontend..."
    (cd frontend && npm install --no-audit --no-fund && npm run build)
  else
    echo "npm not found — skipping build (expecting a prebuilt frontend/dist)."
  fi
fi

if [[ ! -d frontend/dist ]]; then
  echo "ERROR: frontend/dist missing. Build on a machine with node and copy it over," >&2
  echo "       or run: cd frontend && npm install && npm run build" >&2
  exit 1
fi

# Friendly double-launch guard.
if command -v curl >/dev/null 2>&1 && curl -s --max-time 2 http://localhost:8000/api/health >/dev/null 2>&1; then
  echo "ERROR: port 8000 is already in use — the app may already be running." >&2
  exit 1
fi

# Interpreter: venv first, then system (Linux-only — this bundle targets the
# cof Jupyter workspace).
if [[ -x .venv/bin/python ]]; then
  PY=.venv/bin/python
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

echo ""
echo "  Banking app   (Tab 1):  http://localhost:8000/"
echo "  Control panel (Tab 2):  http://localhost:8000/#/panel"
echo "  Behind a Jupyter proxy: <workspace-url>/proxy/8000/ and /proxy/8000/#/panel"
echo ""
echo "  In the app: flip the rail toggle to REAL, arm a scenario card, send."
echo "  Agent + request logs stream below (ONESHIELD_LOG=0 to silence)."
echo ""

exec "$PY" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --log-level info
