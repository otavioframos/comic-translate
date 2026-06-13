"""
Lists every `main_page.<attr>` the real comic-translate code reads, so you know
exactly what HeadlessMainPage must provide. This turns "what does the shim need?"
into a generated checklist.

Run from the repo root (the folder containing pipeline/ and controller.py):

    python web_server/discover_main_page_attrs.py
"""
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent  # repo root (parent of web_server)
PATTERN = re.compile(r"(?:self\.)?main_page\.([A-Za-z_][A-Za-z0-9_]*)")


def main():
    hits = Counter()
    first_seen = {}
    for py in ROOT.rglob("*.py"):
        if "web_server" in py.parts or ".venv" in py.parts:
            continue
        try:
            text = py.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for match in PATTERN.finditer(text):
            attr = match.group(1)
            hits[attr] += 1
            first_seen.setdefault(attr, str(py.relative_to(ROOT)))

    if not hits:
        print("No `main_page.*` accesses found. Are you in the repo root?")
        return

    print(f"{'attribute':32}{'uses':>6}   first seen in")
    print("-" * 72)
    for attr, n in hits.most_common():
        print(f"{attr:32}{n:>6}   {first_seen[attr]}")
    print(f"\n{len(hits)} distinct attributes — each must exist on HeadlessMainPage.")
    print("Add any that are missing to web_server/headless_main_page.py.")


if __name__ == "__main__":
    main()
