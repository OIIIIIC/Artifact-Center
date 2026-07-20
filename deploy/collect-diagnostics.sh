#!/bin/sh

# 在 Ubuntu 生产主机生成可直接交给 AI 分析的脱敏诊断 Markdown。
set -u

SINCE='30m'
REQUEST_ID=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    --since)
      SINCE=${2:?--since 需要时间范围，例如 30m}
      shift 2
      ;;
    --request-id)
      REQUEST_ID=${2:?--request-id 需要请求 ID}
      shift 2
      ;;
    *)
      echo "未知参数: $1" >&2
      echo "用法: $0 [--since 30m] [--request-id REQUEST_ID]" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$PROJECT_DIR/compose.prod.yml"
OUTPUT_DIR="$PROJECT_DIR/.diagnostics"
STAMP=$(date -u '+%Y%m%dT%H%M%SZ')
OUTPUT_FILE="$OUTPUT_DIR/incident-$STAMP.md"

if [ ! -f "$ENV_FILE" ]; then
  echo "未找到 $ENV_FILE，请在生产部署目录中运行。" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

{
  echo '# Artifact Center 诊断包'
  echo
  echo '> 分享前请人工复核。本文件不主动采集环境变量、请求体、数据库内容或认证信息。'
  echo
  echo '## 请补充的现象'
  echo
  echo '- 操作：'
  echo '- 发生时间（含时区）：'
  echo '- 预期结果：'
  echo '- 实际结果：'
  echo '- 是否稳定复现：'
  echo
  echo '## 采集条件'
  echo
  echo "- UTC 采集时间：$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- 日志范围：$SINCE"
  if [ -n "$REQUEST_ID" ]; then
    echo "- 请求 ID：$REQUEST_ID"
  else
    echo '- 请求 ID：未指定'
  fi
  echo
  echo '## 主机概况'
  echo
  echo '```text'
  uname -srmo 2>&1 || true
  uptime 2>&1 || true
  df -h 2>&1 || true
  echo '```'
  echo
  echo '## 容器状态'
  echo
  echo '```text'
  compose ps 2>&1 || true
  CONTAINER_IDS=$(compose ps -q 2>/dev/null || true)
  if [ -n "$CONTAINER_IDS" ]; then
    # 仅查看本项目容器，避免把同一主机上的其他系统带入诊断包。
    docker stats --no-stream $CONTAINER_IDS 2>&1 || true
  fi
  echo '```'
  echo
  if [ -n "$REQUEST_ID" ]; then
    echo '## 请求 ID 命中日志'
    echo
    echo '```text'
    compose logs --no-color --since "$SINCE" api web postgres 2>&1 |
      grep -F -- "$REQUEST_ID" || true
    echo '```'
    echo
  fi
  echo '## 最近日志（最多 5000 行）'
  echo
  echo '```text'
  compose logs --no-color --since "$SINCE" api web postgres 2>&1 |
    tail -n 5000 || true
  echo '```'
} | sed -E \
  -e 's/(Bearer )[A-Za-z0-9._~+\/=:-]+/\1[REDACTED]/g' \
  -e 's#(/api)?/public/shares/[^/ ?"]+#\1/public/shares/[REDACTED]#g' \
  -e 's/("(password|secret|token)"[[:space:]]*:[[:space:]]*")[^"]*/\1[REDACTED]/g' \
  >"$OUTPUT_FILE"

echo "$OUTPUT_FILE"
