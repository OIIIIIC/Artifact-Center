## 2026-09-14 发布前评审

输出文件：2026-09-14.md
分支：main
本次范围：用户本次功能变更，`7dfcf269..cff1cbf2`；另对待推送的既有分享权限和收藏回退路径进行针对性复查。
commit 范围：

- 7d3161ea5bd8f1503fc6e5ce2d54f46ce35fba72 feat(目录): 支持项目下载前缀并完善产品维护
- c1b07e388a4dc7be7bd55aa4dade4250170b0bde feat(制品): 展示精确上传时间与时区
- cff1cbf2c0fb7e3522105251d752253d7e8143b3 style(成员): 展示用户头像并调整操作区对齐

结果：2 个发布风险已修复，355 项测试和前后端镜像构建通过；生产迁移演练单独记录于本次部署结果。

## 2026-08-29 16:18:00 评审

输出文件：2026-08-29.md
分支：main
commit 范围：

- edf3281821c99d55a83db167caeb93c6a1818765 fix(诊断): 兼容内网环境复制报告
- 4cc59195426b40d2739c2f8f94715be73c684d14 feat(权限): 支持地域与应用授权管理
- 73855573db5c2a508dbf3fb177651941a34c8f21 feat(上传): 支持断点续传与对象存储
- f6724d15d43efc5a2169c3f3373d698872add303 feat(应用): 增强目录与发布信息体验
- 2bd5f5c9ccc95a1d645177af18d3c5cb0882a0d5 feat(设置): 重构账户与管理入口
- f9282a725eebc6cd5e6b877de8cae69a34eed8f5 feat(上传): 优化版本建议与分步体验
- 103b3fc6c4010a54e17fbbed67d994e78f0f3d53 chore(部署): 完善离线包与对象存储说明
- e01da6fd41411c0967f7e3058b98ddb884cf99a6 docs(评审): 记录权限改动复查结果
- 0eaa9acf623e40a5dfd5af6d923bc1345f0231ca feat(存储): 支持内部 MinIO 预签名代理
- bd7f4935fed703c1cc81d3d3b0e8b6472af6e548 fix(上传): 兼容 HTTP 环境的续传标识
- ce37a57b369bfe29adf4250a55a7cfa011416dd0 fix(上传): 对象存储异常时回退分片代理
- 5d78db7b212782c843c0e00131936e56ba337fe4 fix(应用): 修复发布时间并展示成员头像
- 376740a11475f0e3b415ab4b72e0c7c98ac782de fix(交互): 优化地域选择与中文搜索
- dfffce70698c056e309a9b121e0913a4c046ae68 style(上传): 对齐底部操作按钮
- 77014011b85277528b5e7aa84d36dc40a782861f fix(分享): 修复匿名下载令牌解析
- 0ff3c43c1226639d0955e16cbe546edc78bfd0e5 feat(分享): 到期自动吊销链接
- ce21b54a16da50d767f3a05f451bf1c9a6ead290 feat(日志): 展示操作所属项目
- 001c1760962d8dbadb1dbad6c11fe721e43fab22 feat(发布): 增加发布机器人和统一制品命名
- 396f1ae0f8d676163bdd7a20fda0542073473257 fix(分享): 支持发布说明 Markdown 展示
- e01c17e290344d78f38c6c1b6ead2828377364e1 feat(应用): 支持重复和批量设置应用代码
- b349e101c757912a8731468db309c5e86a7c6dd6 feat(发布): 增加 Artifact Center MCP 安全发布
- e8a79f8ff55f27f4b58e245b1c0188b6796b9acc feat(应用): 完善应用权限与外观管理
- dc4ed241f7e0acd901b3cebd7a32462204b9e1f5 fix(制品): 修复列表显示与操作日志刷新
- 9188e3a75c26fecff2fb8641af2b923883d76d33 feat(用户): 支持本地头像库
- 284a6d4b3dee4df4be29ca227e2556715daca2e8 feat(下载): 增加生命周期确认提示
- 9b05648309e3664920bd9999fa4027a6de957a06 feat(发布): 支持编辑和折叠发布说明
- 8d1262e32c691537fd808e746e98c4771445344f feat(应用): 在成员列表展示用户头像
- a39eb186a1adf78a0a4cf57998913a912d8ee593 feat(用户): 内置3D头像库
- a17ff980245b4b702a983ea26a8e4db79efd076e feat(界面): 支持固定工作区表格
- e09b5e7c7b3a283c411dba004ce251e5b85df5a5 feat(地域): 重构地域管理工作区
- 6c310132be3c05a27e4e8cbd8cd8dcfd61f2fe4e feat(访问权限): 重构批量授权工作区
- de8f897d4ce988be236466b4c3050a0078733a81 feat(成员): 支持安全移交管理员权限
- 83a9f41813ea1c74117fcfabdb9f5de4b72a229b feat(操作日志): 统一固定工作区样式
- 02a9bf4653fd77309f2a7289fdcd913cdc2d520d fix(访问权限): 对齐账户信息与操作区
- 3fd8f99b49c9fd0b122a81e378b9105b1c239b30 feat(应用): 简化顶部背景装饰
- 当前工作区未提交变更

## 2026-08-11 18:00:00 评审

输出文件：2026-08-11.md
分支：main
commit 范围：

- edf3281821c99d55a83db167caeb93c6a1818765 fix(诊断): 兼容内网环境复制报告
- 202452379e4ae2ef609df84becc4e095369210fe fix(账户): 修复头像上传边界校验
- 当前工作区未提交变更
