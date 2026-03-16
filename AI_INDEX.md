# FreyaUnits AI Index

Machine-first routing index for fast agent execution in `qbitos-freya`.

## 1) Start Here

1. Read `AGENTS.md` for repo context and constraints.
2. Read `IMPLEMENTATION_ORDER.md` for deterministic edit flow.
3. Read `BACKEND_MATRIX.json` for chat backend routing/env vars.
4. Run quick verification commands before and after edits.

## 2) Canonical Lineage

- Source-of-truth product evolution: `qbitOS/uvspeed`
- Deploy/package surface: `qbitOS/qbitos-freya` (runtime parity target, not a full folder-structure mirror)
- Promotion/publish lane: `qbitOS/uvmis-evolution-agent`

Agents should avoid architectural drift between these three repos and keep runtime behavior aligned.
Do not mirror every folder one-to-one; keep canonical lineage, runtime parity, and metadata/indexing parity.

## 3) Primary Edit Targets

- UI surfaces:
  - `freya-landing.html`
  - `freya-units.html`
  - `freya-terminal.html`
- CLI/tooling:
  - `freya` (unified CLI router)
  - `tools/freya-math-cli.py`
  - `tools/freya-hexcast-cli.py`
- Discovery/indexing:
  - `AGENTS.md`
  - `.vibe/skills/freyaunits/SKILL.md`
  - `llms.txt`, `robots.txt`, `sitemap.xml`

## 4) Fast Verification Commands

```bash
./freya math expr "sin(pi/4)^2 + cos(pi/4)^2"
./freya math econ --tb 474000000 --cost 400 --pct-a 20 --pct-b 2
./freya models --backend all
./freya chat --backend auto --family mistral "Convert 100 USD to EUR"
```

## 5) Acceptance Gates

- No API keys committed.
- `freya` works with `--backend auto` and explicit backends.
- Top-level metadata/discovery files remain present and coherent.
- HTML pages preserve script stack:
  - `quantum-prefixes.js`
  - `qbit-dac.js`
  - `qbit-steno.js`
  - service worker registration
