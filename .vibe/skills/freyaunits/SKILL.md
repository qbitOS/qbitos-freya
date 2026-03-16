---
name: freyaunits
description: FreyaUnits project skill for conversion, dither, and terminal workflows.
license: Apache-2.0
compatibility: Python 3.12+
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - edit_file
  - run_terminal_cmd
---

# FreyaUnits Skill

Use this skill when working on `qbitOS/qbitos-freya`.

## Scope

- `freya-landing.html`, `freya-units.html`, `freya-terminal.html`
- `tools/freya-math-cli.py`, `tools/freya-hexcast-cli.py`
- metadata and indexing files (`robots.txt`, `sitemap.xml`, `manifest.json`)

## Preferred commands

```bash
uv run python tools/freya-hexcast-cli.py render path/to/image.png --width 90
uv run python tools/freya-hexcast-cli.py batch
uv run python tools/freya-math-cli.py expr "sin(pi/4)^2 + cos(pi/4)^2"
```

## Output expectations

- Keep UI updates lightweight and mobile-safe.
- Preserve canonical URLs and structured metadata on top-level pages.
- Ensure CLI examples are copy-paste ready.

