#!/bin/sh

# 只读核验已运行的服务与 Web 健康检查；不会修改容器、数据或配置。
set -eu

MODE='production'
while [ "$#" -gt 0 ]; do
  case "$1" in
    --offline) MODE='offline'; shift ;;
    --production) MODE='production'; shift ;;
    *)
      echo "未知参数: $1" >&2
      echo "用法: $0 [--offline|--production]" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
ENV_FILE="$SCRIPT_DIR/.env"
if [ "$MODE" = 'offline' ]; then
  COMPOSE_FILE="$PROJECT_DIR/compose.offline.yml"
else
  COMPOSE_FILE="$PROJECT_DIR/compose.prod.yml"
fi

fail() {
  echo "运行核验未通过：$1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail '未找到 Docker 命令。'
[ -f "$ENV_FILE" ] || fail "未找到 $ENV_FILE。"
[ -f "$COMPOSE_FILE" ] || fail "未找到 $COMPOSE_FILE。"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

for service in postgres api web; do
  container_id=$(compose ps --status running -q "$service")
  [ -n "$container_id" ] || fail "$service 未处于运行状态。"
done

APP_PORT=$(sed -n 's/^[[:space:]]*APP_PORT[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" | tail -n 1)
APP_PORT=${APP_PORT:-8080}
case "$APP_PORT" in
  *[!0-9]*|'') fail 'APP_PORT 必须是数字端口。' ;;
esac

command -v curl >/dev/null 2>&1 || fail '未找到 curl，无法进行 Web 健康检查。'
curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$APP_PORT/healthz" >/dev/null || fail 'Web 健康检查失败。'

echo "运行核验通过：postgres、api、web 均在运行，http://127.0.0.1:$APP_PORT/healthz 正常。"
