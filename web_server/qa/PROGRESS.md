# Progress — Step 1 QA

Tracks the acceptance criteria in [GOAL.md](./GOAL.md). Check items as they pass;
annotate any you can't with the blocker.

## Setup
- [ ] 1. On branch `add-local-web-server`, working from repo root
- [ ] 2. `setup_mac.sh` completed: `.venv`, deps, Ollama installed, model pulled

## Server up
- [ ] 3. Server starts; `/health` returns `status: ok` + model name

## Translation round-trip
- [ ] 4. Japanese page → HTTP 200 + PNG written
- [ ] 5. `debug_out/01_blocks.png`: green boxes correctly on speech bubbles (detection)
- [ ] 6. Evidence OCR produced non-empty source text
- [ ] 7. Evidence Ollama was called and returned non-empty translations ($0 path)
- [ ] 8. `debug_out/02_inpainted.png`: original text erased (inpaint)

## Code completed
- [ ] 9. No `Shim incomplete` (501) errors; added shim attributes documented
- [ ] 10. Wrong `(VERIFY)` names corrected to match real code
- [ ] 11. Korean page run, or recorded as "not tested — no sample"

## Deliverables
- [ ] 12. `qa/QA_REPORT.md` written (pass/fail, shim attrs, fixes, model, latency)
- [ ] 13. This file fully checked or annotated
- [ ] 14. Changes committed + pushed; no `.env`/`debug_out`/`.venv`/models committed
