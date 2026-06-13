"""
Free, local translation via Ollama. This replaces the paid GPT / Claude / Gemini
calls in the original app. Nothing leaves the machine; cost is $0 per page.

The server calls translate_lines() with the text it OCR'd from the page and gets
back the translated lines in the same order.
"""
import requests

from config import CONFIG

SYSTEM_PROMPT = (
    "You are a professional comic, manga, manhwa and manhua translator. "
    "You will receive numbered lines of {src} text taken from speech bubbles. "
    "Translate each line into natural, fluent {tgt}. "
    "Rules:\n"
    "- Keep the EXACT same numbering and the same number of lines.\n"
    "- Preserve tone, emotion and honorifics where they read naturally.\n"
    "- Keep sound effects as short {tgt} sound words.\n"
    "- Output ONLY the numbered translations. No notes, no explanations."
)


def translate_lines(lines, src, tgt, model=None, host=None, timeout=180):
    """
    lines: list[str]  ->  list[str] of the same length and order.
    Empty input returns an empty list. Any line the model drops comes back "".
    """
    lines = [("" if t is None else str(t)) for t in lines]
    if not any(s.strip() for s in lines):
        return ["" for _ in lines]

    model = model or CONFIG.ollama_model
    host = host or CONFIG.ollama_host

    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(lines))
    payload = {
        "model": model,
        "messages": [
            {"role": "system",
             "content": SYSTEM_PROMPT.format(src=src, tgt=tgt)},
            {"role": "user", "content": numbered},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    }

    resp = requests.post(f"{host}/api/chat", json=payload, timeout=timeout)
    resp.raise_for_status()
    content = resp.json()["message"]["content"]
    return _parse_numbered(content, len(lines))


def _parse_numbered(text, n):
    """Turn '1. Hello\n2. World' back into ['Hello', 'World']."""
    out = {}
    for raw in text.splitlines():
        raw = raw.strip()
        if not raw or "." not in raw:
            continue
        head, _, rest = raw.partition(".")
        if head.strip().isdigit():
            out[int(head.strip()) - 1] = rest.strip()
    return [out.get(i, "") for i in range(n)]


def ping(model=None, host=None):
    """Quick check that Ollama is up and the model is available."""
    host = host or CONFIG.ollama_host
    model = model or CONFIG.ollama_model
    tags = requests.get(f"{host}/api/tags", timeout=10).json()
    names = [m.get("name", "") for m in tags.get("models", [])]
    return any(n == model or n.startswith(model.split(":")[0]) for n in names)
