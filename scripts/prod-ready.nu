#!/usr/bin/env nu

# beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}
# Production readiness checker for erika.qbitos.ai deploy lane.

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

let base = ($env.PROD_BASE_URL? | default "https://erika.qbitos.ai")
let domain_raw = (($base | str replace -r '^https?://' '') | split row '/' | get 0)
let domain = ($domain_raw | split row ':' | get 0)
let api_key = ($env.FREYA_ERIKA_API_KEY? | default ($env.CODEX_API_KEY? | default ""))
let env_file = ($env.PROD_ENV_FILE? | default "/etc/qbitos/freya-codex.env")
let dry_run = (($env.PROD_DRY_RUN? | default "1") == "1")

print $"[prod] base=($base)"
print $"[prod] domain=($domain)"
print $"[prod] dry_run=($dry_run)"

run_check "freya compile" "uv run python -m py_compile ./freya"
run_check "codex api compile" "uv run python -m py_compile ./codex_api.py"
run_check "deploy env template exists" "test -f ./deploy/env/codex_api.env.example"
run_check "deploy systemd unit exists" "test -f ./deploy/systemd/freya-codex-api.service"
run_check "deploy nginx config exists" "test -f ./deploy/nginx/erika.qbitos.ai.conf"
run_check "deploy caddy config exists" "test -f ./deploy/caddy/Caddyfile.erika.qbitos.ai"
run_check "deploy script exists" "test -f ./scripts/deploy-codex.sh"
run_check "deploy compliance headers" "rg -n \"beyondBINARY quantum-prefixed\" ./deploy ./scripts/deploy-codex.sh ./scripts/prod-ready.nu | ignore"

if $dry_run {
  print "[prod] dry-run mode: skipping live DNS/TLS/API checks"
  if (($api_key | str length) > 0) {
    print "  PASS: api key configured for live checks (advisory)"
  } else {
    print "  WARN: api key configured for live checks (advisory)"
  }
  if (($env_file | str length) > 0) {
    print "  PASS: expected server env path set (advisory)"
  } else {
    print "  FAIL: expected server env path set (advisory)"
    $env.failed = ($env.failed | append "expected server env path set (advisory)")
  }
} else {
  run_check "dns resolves production domain" $"bash -lc 'nslookup ($domain) >/dev/null'"
  run_check "https health endpoint" $"bash -lc 'curl -fsS \"($base)/health\" >/dev/null'"
  run_check "integration endpoint" $"bash -lc 'curl -fsS \"($base)/api/v1/system/integration\" >/dev/null'"
  run_check "plans endpoint" $"bash -lc 'curl -fsS \"($base)/api/v1/pay/plans\" >/dev/null'"
  if (($api_key | str length) > 0) {
    print "  PASS: api key present"
  } else {
    print "  FAIL: api key present"
    $env.failed = ($env.failed | append "api key present")
  }
  run_check "api tools endpoint (auth)" $"bash -lc 'curl -fsS \"($base)/api/v1/freya/tools\" -H \"X-API-Key: ($api_key)\" >/dev/null'"
  run_check "api run bridge (auth)" $"FREYA_ERIKA_API_KEY=\"($api_key)\" ./freya erika run --base \"($base)\" --tool math.expr --args-json '{\"expression\":\"2+2\"}' | ignore"
}

let failed = $env.failed
if ($failed | is-empty) {
  print "[prod] PASS"
  exit 0
} else {
  print $"[prod] FAIL: ($failed | str join ', ')"
  exit 1
}
