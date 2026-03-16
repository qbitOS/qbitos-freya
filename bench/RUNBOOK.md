# FreyaUnits Bench Runbook

## 1) Freeze run inputs

- Prompt: use `bench/stock-prompt.txt` exactly.
- Use fixed generation settings for comparability:
  - `temperature=0`
  - `top_p=1`
  - `max_tokens=700`
- Record current git SHA before running.

## 2) Execute on each target

Recommended canonical surfaces:

- ugrad Model Lab
- Mistral AI Studio / API
- Other model providers via API or scripted CLI

## 3) Capture result fields

For each run, append one JSON line to `bench/results.jsonl` matching `bench/result-schema.json`.

Minimum required:

- provider/model
- commit SHA
- full prompt
- generation settings
- p50/p95 latency
- output object and raw output
- verdict + notes

## 4) PASS/FAIL interpretation

- PASS: schema valid, numeric fields present/coherent, no fatal errors, metrics captured.
- FAIL: schema mismatch, missing fields, failed reasoning, or missing metrics/evidence.

## 5) Publish proof

- Commit updated `bench/results.jsonl`.
- Reference commit SHA when reporting verdict externally.

