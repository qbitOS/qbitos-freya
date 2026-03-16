# FreyaUnits Agent Context

This file exposes project context for agent-capable CLIs (including Mistral Vibe) that auto-discover `AGENTS.md` at workspace root.

## Project

- Name: `FreyaUnits`
- Domain: `https://freya.qbitos.ai`
- Repo: `https://github.com/qbitOS/qbitos-freya`
- Stack: static HTML + JS + CSS, no build step required

## Primary Pages

- `freya-landing.html` — launch surface
- `freya-units.html` — full app (convert, calc, celestial, codex, quantum, dither)
- `freya-terminal.html` — terminal lane and toolchain references

## Core Tooling Surfaces

- `tools/freya-math-cli.py` — econ/expr CLI
- `tools/freya-hexcast-cli.py` — dither CLI (`render`, `pack`, `batch`)
- `tools/generate_freya_logos.py` — Freya character asset generator

## Agent Guidance

- Prefer direct file edits and keep pages self-contained.
- Keep metadata and canonical URLs in sync for all user-facing pages.
- Preserve `quantum-prefixes.js`, `qbit-dac.js`, `qbit-steno.js`, and service worker wiring.
- For CLI docs, default commands should use `uv run python ...`.

## Verification Commands

```bash
uv run python tools/freya-hexcast-cli.py --help
uv run python tools/freya-hexcast-cli.py batch
uv run python tools/freya-math-cli.py --help
```

