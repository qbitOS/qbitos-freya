# Freya Launch Fork + Wearable Integration Plan

## Purpose

This plan defines the launch fork and wearable-readiness path for the FreyaUnits bracelet surface, centered on the vertical logarithmic scale and OLED-style precision readout.

## Scope

- Add a dedicated Bracelet section in `freya-units.html`.
- Ship a vertical logarithmic scale with touch-first zoom-wheel behavior.
- Keep readout parity with convert scale (hover, drag, scroll, current).
- Link benchmark and noBLINK readiness before wearable rollout.

## Pre-Flight Checklist

- [ ] iOS Safari touch drag behaves like camera zoom wheel (up = zoom in, down = zoom out).
- [ ] Android Chrome pointer/touch behavior matches iOS within tolerance.
- [ ] Desktop wheel and pointer interactions remain deterministic and smooth.
- [ ] DPR-aware rendering stays crisp on 1x, 2x, 3x displays.
- [ ] Orientation and viewport resize trigger redraw without drift.
- [ ] Clamp guard active for extreme values (`1e-24` to `1e120`).
- [ ] Off-canvas indicator appears when value is outside visual range.
- [ ] Nearest-unit metadata remains accurate across full span (`10^-35` to `10^17` meters).
- [ ] T5 noBLINK readiness check documented and runnable locally.
- [ ] Stock bench prompt path is visible for cross-model PASS/FAIL runs.

## Interaction Model (Wearable)

1. Touch down on the vertical scale sets current reference point.
2. Vertical drag applies exponential gain to mimic camera zoom wheel feel.
3. Live OLED readout shows exact value, unit, and decade.
4. Releasing touch locks current value into converter state.

## Bench + Validation

- Use stock prompt from `bench/stock-prompt.txt`.
- Record runs into `bench/results.jsonl` using `bench/result-schema.json`.
- Gate launch on checklist completion and repeatable PASS evidence.

## Release Gate

Bracelet launch fork is ready when:

- The pre-flight checklist is fully checked.
- At least one PASS run exists per target model/site lane.
- Touch + resize behavior remains stable across mobile and desktop.
