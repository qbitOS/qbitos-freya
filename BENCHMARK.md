# FreyaUnits Cross-Model Benchmark Policy

This document defines what must be collected to claim model benchmark PASS/FAIL status for `qbitos-freya`.

## Official Verdict Rule

- Foundation readiness is based on architecture and instrumentation.
- Cross-model certification requires reproducible evidence for each model/provider pair.
- Claims such as "all AI models benchmarked and certified" are only valid when required evidence exists in `bench/results.jsonl`.

## Required Evidence Per Run

- `model` and `provider`
- `timestamp` (ISO-8601)
- `commit_sha`
- `site_surface` (e.g. `freya-units`)
- exact `prompt` text
- fixed generation settings (`temperature`, `top_p`, `max_tokens`)
- raw model output
- JSON schema validation result
- latency metrics (`p50_ms`, `p95_ms`)
- verdict (`PASS` or `FAIL`) and notes

## Pass Criteria (Minimum)

1. Output is parseable and matches required schema.
2. Numeric fields are present and coherent with prompt request.
3. No fatal generation/runtime errors.
4. Latency and cost are captured.
5. Evidence is committed in machine-readable form.

## Location of Canonical Artifacts

- `bench/stock-prompt.txt`
- `bench/result-schema.json`
- `bench/results.jsonl`
- `bench/RUNBOOK.md`

