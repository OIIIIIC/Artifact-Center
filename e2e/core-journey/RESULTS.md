# 核心浏览器旅程执行结果

执行目标为本地 `http://127.0.0.1:5178`，覆盖登录、查找专用应用、上传并确认 Beta ZIP、认证下载、固定版本公开分享下载，以及安全清理。该结果记录的是一条核心成功路径，不表示全站验收完成。

## 两次独立运行

| 运行 | 结果                            | 用时    | 下载核验                                                                                             |
| ---- | ------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| 6    | 1 passed / 0 failed / 0 skipped | 10.9 秒 | 认证与分享下载均为 194 B，SHA-256 `319e717e9a470528178c8aac0532174f78e1fb3a723e2d031db7e96fc9230d59` |
| 7    | 1 passed / 0 failed / 0 skipped | 10.7 秒 | 认证与分享下载均为 194 B，SHA-256 `012cc0c87907a1005454339b937446818e6687236077323f170eb0a0324eaa5b` |

每轮均在真实 Chromium 浏览器中显式选择并确认 Beta 渠道；两种下载的文件名、字节数和 SHA-256 都与该轮上传的 ZIP 一致。

本地、Git 已忽略的完整证据位于：

- [`output/e2e/core-journey-report-run6.json`](../../output/e2e/core-journey-report-run6.json) 与 [`output/e2e/run6-test-results/`](../../output/e2e/run6-test-results/)
- [`output/e2e/core-journey-report-run7.json`](../../output/e2e/core-journey-report-run7.json) 与 [`output/e2e/run7-test-results/`](../../output/e2e/run7-test-results/)
- [`output/e2e/root-verification.json`](../../output/e2e/root-verification.json)，包含独立的存储清理对比

## 清理与状态恢复

两轮分别删除了本轮登记的专用应用、其制品和分享记录；应用与制品删除后由 API 404 验证，公开链接由匿名浏览器验证为失效。每轮的应用库存和制品计数前后相同（18 个应用、13 个制品），并且 ID/制品计数哈希一致。

工作台偏好、收藏和最近访问在 finally 中恢复；两轮结束后的完整工作台状态都与初始状态 SHA-256 `5ffc3a23441c3bc4a06bb6f2ba6d2ba90a77aa0be30522811538b78b11ad0e80` 一致。独立存储核验同时确认 `data/files` 前后均为 13 个文件、739,036,443 字节，逐路径与大小没有差异。

## 判定与边界

最终两轮均为通过，没有确认的产品或环境失败。在最终两次通过前，SPA 导航超时和定位器问题属于测试实现迭代，均已修正。首轮超时曾中断自动清理；随后仅按已登记的 ID 加名称前缀手动删除专用应用，并以工作台状态哈希精确恢复，见 [`output/e2e/run1-manual-recovery.json`](../../output/e2e/run1-manual-recovery.json)。其余调试轮的创建数据和工作台状态也已恢复。

未覆盖正式发布、其他制品格式、其他角色和权限、失败与恢复路径、分享过期/吊销、多浏览器或移动端，以及 CI 隔离环境。详细执行契约与覆盖矩阵见 [README.md](./README.md) 和 [feature-matrix.json](./feature-matrix.json)。
