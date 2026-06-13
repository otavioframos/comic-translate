#!/usr/bin/env bash
# ===========================================================================
#  Comic-Translate Local Server — ONE-TIME SETUP  (macOS, Apple Silicon)
#  Safe to run again if something fails partway through.
# ===========================================================================
set -e

cd "$(dirname "$0")/.."   # move to the repo root (parent of web_server/)

echo "==> 1/5  Checking you're in the comic-translate project folder..."
if [ ! -d "pipeline" ] || [ ! -f "controller.py" ]; then
  echo "STOP. This must run from the comic-translate project folder"
  echo "(the one that contains 'pipeline' and 'controller.py')."
  exit 1
fi

echo "==> 2/5  Creating an isolated Python environment (.venv)..."
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null

echo "==> 3/5  Installing dependencies (this can take several minutes)..."
pip install -r requirements.txt
pip install -r web_server/requirements-webserver.txt

echo "==> 4/5  Setting up Ollama (the free, local translator)..."
if ! command -v ollama >/dev/null 2>&1; then
  echo ""
  echo "    Ollama is not installed yet."
  echo "    1. Download it (one click): https://ollama.com/download"
  echo "    2. Install it like any Mac app."
  echo "    3. Run this setup script again."
  echo ""
  exit 1
fi

MODEL="$(grep -E '^OLLAMA_MODEL=' web_server/.env 2>/dev/null | cut -d= -f2)"
MODEL="${MODEL:-qwen2.5:7b}"
echo "    Downloading translation model: $MODEL"
echo "    (first time only; it is a few GB, so grab a coffee)"
ollama pull "$MODEL"

echo "==> 5/5  Creating your settings file (web_server/.env)..."
if [ ! -f "web_server/.env" ]; then
  cp web_server/.env.example web_server/.env
  echo "    Created web_server/.env  — edit it later to change model/languages."
else
  echo "    web_server/.env already exists; leaving it untouched."
fi

echo ""
echo "============================================================"
echo " Setup complete."
echo " Start the server with:    ./web_server/run.sh"
echo " Then test it (see):       web_server/TEST_CHECKLIST.md"
echo "============================================================"
