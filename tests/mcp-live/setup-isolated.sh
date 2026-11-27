#!/usr/bin/env bash
set -euo pipefail
umask 077
image=${MCP_E2E_IMAGE:-artifact-center-api:0.1.0-20261020.mcp1}
prefix=${MCP_E2E_PREFIX:-ac-mcp-owned-test}
port=${MCP_E2E_PORT:-23001}
here=$(cd "$(dirname "$0")" && pwd)
[[ "$prefix" =~ ^ac-mcp-[a-z0-9-]+$ ]] || exit 2
[[ "$port" =~ ^[0-9]+$ ]] || exit 2
test -f "$here/fake-jenkins.mjs"
docker image inspect "$image" postgres:16-alpine >/dev/null
docker network create --internal --label artifact-center.mcp-e2e=true "$prefix"
docker run -d --label artifact-center.mcp-e2e=true --name "$prefix-db" --network "$prefix" --network-alias mcp-db \
  --memory 512m --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=artifact -e POSTGRES_DB=mcp_e2e postgres:16-alpine
for i in $(seq 1 30); do docker exec "$prefix-db" pg_isready -U artifact -d mcp_e2e >/dev/null && break; sleep 1; done
docker run -d --label artifact-center.mcp-e2e=true --name "$prefix-jenkins" --network "$prefix" --network-alias mcp-jenkins \
  -v "$here/fake-jenkins.mjs:/app/fake-jenkins.mjs:ro" "$image" node /app/fake-jenkins.mjs
docker run -d --label artifact-center.mcp-e2e=true --name "$prefix-api" --network "$prefix" --tmpfs /data/artifacts:rw,mode=1777 \
  -e DATABASE_URL=postgres://artifact@mcp-db:5432/mcp_e2e \
  -e JWT_SECRET=isolated-mcp-e2e-only-secret-20261020 \
  -e JENKINS_ENCRYPTION_KEY=abababababababababababababababababababababababababababababababab \
  -e SHARE_TOKEN_PEPPER=isolated-mcp-e2e-only-pepper-20261020 \
  -e HOST=0.0.0.0 -e PORT=3001 -e STORAGE_PATH=/data/artifacts -e STORAGE_MIN_FREE_BYTES=1 \
  -e BOOTSTRAP_ADMIN_NAME='MCP E2E Admin' -e BOOTSTRAP_ADMIN_USERNAME=mcp-e2e-admin \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@mcp-e2e.test -e BOOTSTRAP_ADMIN_PASSWORD='Only-Isolated-Test42!' \
  -e CORS_ORIGIN=http://localhost "$image"
ip=$(docker inspect "$prefix-api" --format "{{(index .NetworkSettings.Networks \"$prefix\").IPAddress}}")
[[ "$ip" =~ ^[0-9.]+$ ]] || exit 2
# Internal Docker networks do not publish host ports. Relay only this owned API
# through server loopback; the test driver reaches it through an SSH tunnel.
docker run -d --label artifact-center.mcp-e2e=true --name "$prefix-proxy" --network host -e TARGET_IP="$ip" -e TEST_PORT="$port" "$image" node -e \
  "const net=require('node:net');net.createServer(c=>{const t=net.connect(3001,process.env.TARGET_IP);c.pipe(t).pipe(c);c.on('error',()=>t.destroy());t.on('error',()=>c.destroy())}).listen(Number(process.env.TEST_PORT),'127.0.0.1')"
for i in $(seq 1 40); do curl -fsS "http://127.0.0.1:$port/health/ready" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$port/health/ready"
