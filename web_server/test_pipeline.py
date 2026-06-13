"""
Tiny test client: sends ONE image to the running server and saves the result.
This is the acceptance test for Step 1.

    python web_server/test_pipeline.py path/to/page.png
    python web_server/test_pipeline.py path/to/page.png Korean English
    python web_server/test_pipeline.py path/to/page.png Chinese English
"""
import os
import sys

import requests

BASE = "http://127.0.0.1:8000"


def main():
    if len(sys.argv) < 2:
        print("usage: python web_server/test_pipeline.py <image> [src] [tgt]")
        sys.exit(1)

    image = sys.argv[1]
    src = sys.argv[2] if len(sys.argv) > 2 else "Japanese"
    tgt = sys.argv[3] if len(sys.argv) > 3 else "English"

    if not os.path.exists(image):
        print(f"ERROR: file not found: {image}")
        sys.exit(1)

    # 1) is the server awake?
    try:
        health = requests.get(f"{BASE}/health", timeout=5).json()
        print("server:", health)
    except Exception as exc:  # noqa: BLE001 - friendly message for non-devs
        print("ERROR: the server is not answering on port 8000.")
        print("       Start it first with:  ./web_server/run.sh")
        print("       (details:", exc, ")")
        sys.exit(1)

    # 2) send the page
    print(f"sending {image}  ({src} -> {tgt}) ...")
    with open(image, "rb") as handle:
        resp = requests.post(
            f"{BASE}/translate",
            files={"file": handle},
            data={"src": src, "tgt": tgt},
            timeout=600,
        )

    if resp.status_code != 200:
        print(f"FAILED  (HTTP {resp.status_code})")
        print(resp.text)
        sys.exit(1)

    out = "translated_" + os.path.basename(image)
    with open(out, "wb") as handle:
        handle.write(resp.content)
    print(f"OK  ->  saved {out}  ({len(resp.content)} bytes)")
    print("Open it, and also look inside web_server/debug_out/ for the stages.")


if __name__ == "__main__":
    main()
