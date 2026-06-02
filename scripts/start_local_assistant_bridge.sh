#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${HERMES_PYTHON:-/home/patrick_dietz/.hermes/hermes-agent/venv/bin/python}"
exec "$PY" scripts/local_assistant_bridge.py
