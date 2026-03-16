#!/usr/bin/env nu

# Local pre audit for qbitos-freya repository.

mut failed = []

def run_check [name: string, cmd: string] {
  print $"[check] ($name)"
  nu -c $cmd
  if $env.LAST_EXIT_CODE != 0 {
    print $"  FAIL: ($name)"
    $env.failed = ($env.failed | append $name)
  } else {
    print $"  PASS: ($name)"
  }
}

$env.failed = []

run_check "freya compile" "uv run python -m py_compile ./freya"
run_check "codex api compile" "uv run python -m py_compile ./codex_api.py"
run_check "chunk registry json" "uv run python -m json.tool ./chunks/registry.json | ignore"
run_check "ruleset schema json" "uv run python -m json.tool ./rulesets/schema.json | ignore"
run_check "ruleset default json" "uv run python -m json.tool ./rulesets/default.ruleset.json | ignore"
run_check "enterprise mistral pack json" "uv run python -m json.tool ./enterprise/mistral-enterprise-pack.json | ignore"
run_check "enterprise rbac policy json" "uv run python -m json.tool ./enterprise/rbac-policy.json | ignore"
run_check "enterprise eval suite json" "uv run python -m json.tool ./enterprise/eval-suite.json | ignore"
run_check "enterprise plugin index json" "uv run python -m json.tool ./enterprise/plugin-index.json | ignore"
run_check "deploy env template exists" "test -f ./deploy/env/codex_api.env.example"
run_check "deploy systemd unit exists" "test -f ./deploy/systemd/freya-codex-api.service"
run_check "deploy nginx config exists" "test -f ./deploy/nginx/erika.qbitos.ai.conf"
run_check "deploy caddy config exists" "test -f ./deploy/caddy/Caddyfile.erika.qbitos.ai"
run_check "deploy compliance headers" "rg -n \"beyondBINARY quantum-prefixed\" ./deploy ./scripts/deploy-codex.sh | ignore"
run_check "ruleset validate smoke" "./freya rules validate --file ./rulesets/default.ruleset.json | ignore"
run_check "enterprise compliance smoke" "./freya enterprise compliance-check --role admin --action enterprise.ops-report | ignore"
run_check "enterprise route smoke" "./freya enterprise mistral-route --task code | ignore"
run_check "artifact add/list smoke" "./freya artifact add --kind precheck --name smoke --meta-json '{}' | ignore; ./freya artifact list --kind precheck | ignore"
run_check "rag index/query smoke" "./freya rag index --source README.qmd --glob '*.qmd' --max-chars 4096 | ignore; ./freya rag query --query Freya --top-k 2 | ignore"
run_check "session lifecycle smoke" "./freya chat --backend auto --session precheck-s1 --history-n 0 test | ignore; ./freya session list | ignore; ./freya session archive --id precheck-s1 | ignore; ./freya session show --id precheck-s1 | ignore"
run_check "plugin discover/resolve smoke" "./freya plugin discover | ignore; ./freya plugin resolve --name materials-pack | ignore"
run_check "agent handoff smoke" "./freya agent handoff --from-agent planner --to-agent ops --artifact-id pre-smoke --status PASS --note precheck | ignore; ./freya agent handoff-list --limit 1 | ignore"
run_check "chemistry periodic smoke" "./freya chemistry periodic --query Si | ignore"
run_check "geometry shape smoke" "./freya geometry shape --type circle --a 2 | ignore"
run_check "code codec smoke" "./freya code codec --from ascii --to hex --text freya | ignore"
run_check "time synclock smoke" "./freya time synclock --reference-unix 1710000000.120 --device-unix 1710000000.184 | ignore"
run_check "music transpose smoke" "./freya music transpose --notes 'C4,E4,G4' --semitones 2 --key D | ignore"

let failed = $env.failed
if ($failed | is-empty) {
  print "[pre] PASS"
  exit 0
} else {
  print $"[pre] FAIL: ($failed | str join ', ')"
  exit 1
}
