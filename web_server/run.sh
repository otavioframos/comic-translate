#!/usr/bin/env bash
# ===========================================================================
#  Start the Comic-Translate local server.
#  Leave this window open while you read; press Ctrl+C to stop.
# ===========================================================================
set -e

cd "$(dirname "$0")/.."   # repo root

if [ ! -d ".venv" ]; then
  echo "No .venv found. Run ./web_server/setup_mac.sh first."
  exit 1
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# Apple Silicon: let the few GPU ops Metal doesn't support fall back to the CPU
# instead of crashing the pipeline.
export PYTORCH_ENABLE_MPS_FALLBACK=1
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"

# Load settings so we know the host/port and Ollama address.
set -a
# shellcheck disable=SC1091
[ -f web_server/.env ] && . web_server/.env
set +a
HOST="${CT_HOST:-127.0.0.1}"
PORT="${CT_PORT:-8000}"
OLLAMA="${OLLAMA_HOST:-http://127.0.0.1:11434}"

# Make sure Ollama is running (it serves the free translation model).
if ! curl -s "${OLLAMA}/api/tags" >/dev/null 2>&1; then
  echo "Starting Ollama in the background..."
  ollama serve >/dev/null 2>&1 &
  sleep 2
fi

echo "------------------------------------------------------------"
echo " Comic-Translate server -> http://${HOST}:${PORT}"
echo " Health check          -> http://${HOST}:${PORT}/health"
echo " Press Ctrl+C to stop."
echo "------------------------------------------------------------"

cd web_server
exec uvicorn server:app --host "$HOST" --port "$PORT"
