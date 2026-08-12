#!/bin/sh

# 只读检查部署环境；不会导入镜像、启动/停止容器、修改数据库或写入部署配置。
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
  echo "预检未通过：$1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail '未找到 Docker 命令。'
[ -f "$ENV_FILE" ] || fail "未找到 $ENV_FILE。"
[ -f "$COMPOSE_FILE" ] || fail "未找到 $COMPOSE_FILE。"
docker info >/dev/null 2>&1 || fail 'Docker 服务不可用，或当前账号没有 Docker 权限。'
docker compose version >/dev/null 2>&1 || fail '未找到 Docker Compose Plugin。'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet || fail 'Compose 配置或环境变量无效。'

if [ "$MODE" = 'offline' ] && ! docker network inspect plane-app_default >/dev/null 2>&1; then
  fail '缺少外部网络 plane-app_default。请先确认该网络应由哪项现有服务创建，避免直接在生产主机创建未知网络。'
fi

echo "预检通过：$MODE 模式，Compose 配置有效。"
