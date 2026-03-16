# FreyaUnits Implementation Order

Use this order to minimize regression and speed up agent execution.

## Stage A - Discovery and Context

1. `AGENTS.md`
2. `AI_INDEX.md`
3. `BACKEND_MATRIX.json`

## Stage B - Runtime Core

1. `freya` (CLI command surface, backend routing, model inventory)
2. `tools/freya-math-cli.py` (math/econ primitives)
3. `tools/freya-hexcast-cli.py` (dither tooling)

## Stage C - User Surfaces

1. `freya-units.html` (main app and feature panels)
2. `freya-terminal.html` (terminal lane parity)
3. `freya-landing.html` (entry/positioning and links)

## Stage D - Discovery and Crawl

1. `.vibe/skills/freyaunits/SKILL.md`
2. `llms.txt`
3. `robots.txt`
4. `sitemap.xml`
5. `manifest.json`

## Stage E - Verification

```bash
./freya math expr "sin(pi/4)^2 + cos(pi/4)^2"
./freya math econ --tb 474000000 --cost 400 --pct-a 20 --pct-b 2
./freya models --backend all
./freya chat --backend ollama --family llama3 "hello"
./freya chat --backend ugrad --family codellama "hello"
```

## Stage F - Release Hygiene

1. Ensure no secrets in git (`MISTRAL_API_KEY`, `HF_API_TOKEN`, etc.).
2. Ensure README/AGENTS/SKILL references are in sync.
3. Commit only deterministic source artifacts.
