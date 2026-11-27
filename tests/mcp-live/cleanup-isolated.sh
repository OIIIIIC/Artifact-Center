#!/usr/bin/env bash
set -euo pipefail
prefix=${MCP_E2E_PREFIX:-ac-mcp-owned-test}
[[ "$prefix" =~ ^ac-mcp-[a-z0-9-]+$ ]] || exit 2
for name in "$prefix-proxy" "$prefix-api" "$prefix-jenkins" "$prefix-db"; do
  docker inspect "$name" >/dev/null 2>&1 || continue
  test "$(docker inspect "$name" --format '{{index .Config.Labels "artifact-center.mcp-e2e"}}')" = true
  docker stop -t 15 "$name" >/dev/null
  docker rm "$name" >/dev/null
done
if docker network inspect "$prefix" >/dev/null 2>&1; then
  test "$(docker network inspect "$prefix" --format '{{index .Labels "artifact-center.mcp-e2e"}}')" = true
  docker network rm "$prefix" >/dev/null
fi
