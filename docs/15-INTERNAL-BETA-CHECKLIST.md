# 内测发车清单（P0）

> 不必做完全部优化审计。本清单是内测最低门槛。  
> 详细问题见 `docs/13-OPTIMIZATION-AUDIT.md`；优先级说明见 `memory.md`「优先级裁剪」。

## 1. 配置

本地 `apps/api/.env`（或生产 `deploy/.env`）：

| 变量                 | 要求                                               |
| -------------------- | -------------------------------------------------- |
| `DATABASE_URL`       | 指向真实 PostgreSQL                                |
| `JWT_SECRET`         | 生产 ≥32 随机字符，勿用示例值                      |
| `SHARE_TOKEN_PEPPER` | 生产 ≥32 随机字符，建议与 JWT 不同；开发可回落 JWT |
| `CORS_ORIGIN`        | 生产禁止 `*`，填实际前端源                         |
| `STORAGE_PATH`       | 可写制品目录                                       |

生产还可检查 `POSTGRES_PASSWORD`、`ADMIN_*`（见 `deploy/.env.example`）。

## 2. 数据库

```powershell
cd D:\MyCode\artifact-center
docker compose up -d
npm run db:migrate
npm run db:seed   # 本地演示账号，生产用 ADMIN_* 引导
```

确认迁移含 `0009`、`0010`、`0011`（分享 `token_hash`、JWT `token_version`、制品 sha 索引）。

## 3. 启动与健康

```powershell
npm run dev:api    # 或生产 compose
# 另开：
npm run dev
```

```powershell
# 端口以 .env 为准（本机常见 4001）
Invoke-RestMethod http://localhost:4001/health/live
Invoke-RestMethod http://localhost:4001/health/ready
# ready.checks.database / storage 应为 ok
```

## 4. 主路径冒烟（API）

可用仓库脚本：

```powershell
.\scripts\smoke-p0.ps1 -BaseUrl http://localhost:4001 -Identifier oiiic -Password '***REMOVED***'
```

或手工：

1. `POST /auth/login` 拿到 JWT
2. `GET /applications` 列表
3. （可选）上传一个小文件到某应用
4. `POST /applications/:id/shares` `{ "mode":"latest" }` → 响应含一次性 `token`
5. `GET /public/shares/:token` 可解析且**响应体无 token 字段**
6. `GET /applications/:id/shares` 列表项 `token` 为空，仅有 `tokenPrefix`

## 5. 备份（文档级即可）

见 `docs/11-DEPLOYMENT.md` §6–7：`pg_dump` + 制品目录 tar。内测至少知道备份命令在哪。

## 6. 通过标准

- [ ] migrate 成功到最新
- [ ] `/health/ready` = ok
- [ ] 登录成功
- [ ] 列表/创建分享成功
- [ ] 公开解析成功且不回显 token
- [ ] 生产 env 非默认弱密钥

上传下载文件在有包时再验；无制品时分享解析仍应返回条目（artifact 可为 null）。
