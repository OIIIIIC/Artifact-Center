# 对象存储直传

Artifact Center 默认使用本地分片存储。只要完整设置以下变量，新的制品上传会自动改为浏览器直传 S3 兼容对象存储（MinIO、AWS S3 等）：

- `OBJECT_STORAGE_ENDPOINT`：API 服务连接对象存储的地址，例如 Docker 内 `http://minio:9000`。
- `OBJECT_STORAGE_PUBLIC_ENDPOINT`：浏览器能访问的**根地址**，例如 `https://minio.example.internal`；不能包含路径前缀，因为 S3 预签名会校验完整请求路径。
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY`
- `OBJECT_STORAGE_SECRET_KEY`
- `OBJECT_STORAGE_REGION`：可选，默认 `us-east-1`。

API 只创建短时分片上传地址、记录 ETag 并在完成时校验文件大小与 SHA-256；文件流不经过 API。

## MinIO 准备

1. 创建私有 bucket，例如 `artifacts`。
2. 为访问密钥授予该 bucket 的 multipart 上传、读取和删除权限。
3. 给 bucket 配置 CORS。允许 Web 地址发起 `PUT`，并公开 `ETag` 响应头：

```json
[
  {
    "AllowedOrigins": ["https://artifact-center.example.internal"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

部署后重启 API。旧制品继续从本地磁盘读取；新制品会记录为 S3 存储并通过同一下载接口提供下载。

## 内部 Plane MinIO 代理

离线 Compose 已将 Web 容器加入 `plane-app_default`，并在独立端口代理内部 `plane-minio:9000`。独立端口可保持 S3 预签名路径不变；Nginx 仅允许 `APP_ORIGIN` 跨域上传，并公开 `ETag` 响应头。

在该部署方式下，设置对象存储代理端口与公网根地址，例如：

```dotenv
APP_ORIGIN=http://10.110.200.233:18080
OBJECT_STORAGE_PUBLIC_PORT=18081
OBJECT_STORAGE_PUBLIC_ENDPOINT=http://10.110.200.233:18081
```

不要将该值设为其他应用（例如 Plane）的网关地址，或添加路径前缀；预签名 URL 必须原样抵达同一个 S3/MinIO 服务。
