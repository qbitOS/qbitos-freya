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
run_check "deploy env template exists" "test -f ./deploy/env/codex_api.env.example"
run_check "deploy systemd unit exists" "test -f ./deploy/systemd/freya-codex-api.service"
run_check "deploy nginx config exists" "test -f ./deploy/nginx/erika.qbitos.ai.conf"
run_check "deploy caddy config exists" "test -f ./deploy/caddy/Caddyfile.erika.qbitos.ai"
run_check "deploy compliance headers" "rg -n \"beyondBINARY quantum-prefixed\" ./deploy ./scripts/deploy-codex.sh | ignore"
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
