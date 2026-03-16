<!--
Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
SPDX-License-Identifier: Apache-2.0
Source: https://github.com/qbitOS/qbitos-freya
Provenance: mistral-enterprise-readiness-dossier
-->

# Mistral Enterprise Readiness Dossier

## Executive Scorecard

- Current target rating: **9.5 / 10**
- Scope: Mistral integration, enterprise controls, eval reliability, and ops deployment
- Status: **Foundation shipped** (controls + tooling + deployment pack)

## What Mistral Cares About

1. Production trust signals (SLO, auditability, incident readiness)
2. Mistral-native integration path (routing, fallback, measurable performance)
3. Enterprise integration surface (stable API, auth, observability)
4. Governance and controls (rulesets, artifact lineage, policy enforcement)

## Pack 1: Mistral Enterprise Pack

- File: `enterprise/mistral-enterprise-pack.json`
- Added:
  - Task-specific Mistral model map (`chat`, `code`, `analysis`, `ops`)
  - Backend fallback chain (`mistral -> ugrad -> lmstudio -> ollama -> huggingface`)
  - Retry policy structure
  - Observability flags for latency/error/cost
- CLI:
  - `./freya enterprise mistral-route --task code`
  - `./freya models --route-task code --family codellama`

## Pack 2: Security + Compliance Pack

- Files:
  - `enterprise/rbac-policy.json`
  - `rulesets/schema.json`
  - `rulesets/default.ruleset.json`
- Added:
  - Role-based action policy scaffold (admin/operator/auditor/viewer)
  - Ruleset validation and activation
  - Ruleset runtime enforcement for chunk execution
  - Enterprise audit logging stream (`.freya/audit-log.jsonl`)
- CLI:
  - `./freya enterprise compliance-check --role auditor --action enterprise.ops-report`
  - `./freya enterprise audit-log --actor ci --role operator --action deploy --resource erika --status PASS`

## Pack 3: Enterprise Eval Pack

- File: `enterprise/eval-suite.json`
- Added:
  - Single-prompt cross-backend evaluator with latency metrics
  - Suite runner for multiple enterprise prompts
  - Winner selection by successful lowest latency
- CLI:
  - `./freya enterprise eval --prompt "Summarize rollout risk" --backends "mistral,ugrad,lmstudio,ollama,huggingface"`
  - `./freya enterprise eval-suite --suite-file enterprise/eval-suite.json`

## Pack 4: Operations Pack

- Files:
  - `deploy/k8s/freya-codex-api-deployment.yaml`
  - `deploy/k8s/freya-codex-api-service.yaml`
  - `deploy/k8s/freya-codex-api-hpa.yaml`
- Added:
  - Kubernetes deployment baseline (readiness/liveness probes, resource bounds)
  - Service wiring
  - Autoscaling policy
  - Ops/SLO report command from runtime state
- CLI:
  - `./freya enterprise ops-report --window-hours 24`

## Enterprise Readiness Checklist

- [x] Mistral-first route policy
- [x] Backend fallback sequence
- [x] Ruleset validation + activation
- [x] Runtime policy enforcement
- [x] RBAC policy definition
- [x] Audit log stream
- [x] Artifact lifecycle tracking
- [x] Session + memory primitives
- [x] RAG indexing + retrieval
- [x] Cross-backend enterprise eval
- [x] Kubernetes ops starter manifests

## Next Milestones (to 10/10)

1. Add tenant-aware RBAC and scoped API keys
2. Add OpenTelemetry trace export and dashboard bundle
3. Add signed artifact attestations and immutable release metadata
4. Add SOC2/GDPR control mapping docs with automated evidence collection
