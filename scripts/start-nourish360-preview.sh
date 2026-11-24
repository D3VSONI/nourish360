#!/usr/bin/env bash
set -euo pipefail

api_port=8080
web_port=20154
api_log=/tmp/nourish360-preview-api.log

setsid env PORT="$api_port" pnpm --filter @workspace/api-server run dev >"$api_log" 2>&1 &
api_pid=$!

cleanup() {
  kill -TERM -- "-$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$api_port/api/healthz" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    cat "$api_log" >&2
    exit 1
  fi
  sleep 0.5
done

if [ "$ready" -ne 1 ]; then
  cat "$api_log" >&2
  echo "Nourish360 API did not become ready on port $api_port." >&2
  exit 1
fi

PORT="$web_port" BASE_PATH=/ API_PROXY_TARGET="http://127.0.0.1:$api_port" \
  pnpm --filter @workspace/nourish360 run dev
