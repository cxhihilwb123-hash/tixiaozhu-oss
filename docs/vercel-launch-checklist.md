# 题小助 Vercel 上线清单

更新时间：2026-05-14 CST

## 当前 Vercel 项目

- Vercel scope: `cxhihilwb123-hashs-projects`
- Project: `tixiaozhu`
- Project ID: `prj_2eRw5Sw3jX8WWk3gLfKY2Mm6lNq4`
- GitHub: `https://github.com/cxhihilwb123-hash/tixiaozhu`
- Current Vercel URL: `https://tixiaozhu.vercel.app`

本仓库已补充 Vercel 适配：

- `vercel.json`：构建学生端和后台端，并把所有请求交给 `/api` handler。
- `api/index.js`：Vercel Function 入口，复用后端 `requestHandler`。
- `backend/src/server.js`：本地仍可 `listen`，Vercel 环境只导出 handler。
- `.vercelignore`：排除本地密钥、测试产物、构建产物和依赖目录。
- `ignoreCommand`：生产环境变量未配置前，默认忽略 Git 自动部署；当前已在 Production 设置 `ENABLE_VERCEL_AUTODEPLOY=true`，后续 Git push 到 `main` 会自动发布。

## 已验证

```bash
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm run audit:runtime-security
npx vercel build --yes
```

当前结果：

- Vercel 本地 build 已通过。
- Vercel handler 模式下 `/api/health`、`/`、`/admin/` 可返回。
- Vercel 远端项目已创建并连接 GitHub。
- Vercel 生产别名已部署到 `https://tixiaozhu.vercel.app`，当前用于链路验证，不代表正式 Go。
- Neon Postgres 已创建并连接：`tixiaozhu-postgres`，resource id `store_s4sfrkzkbIbH9w1m`。
- Vercel Blob 已创建并连接：`tixiaozhu-prod-assets`，store id `store_Y9pXWQqjEdKy3BUW`，private，`iad1`。
- Neon 数据已导入并反向导出校验：`252` 题包、`6912` 题、`108` 知识点、`5` 用户。
- Vercel Alerts 已启用项目生产口径：`VERCEL_ALERTS_ENABLED=true`，CLI 可见 `Default Alert Rule`。
- 线上 smoke 已验证基础链路：`/api/ready`、健康检查、支付延期隐藏、学生强认证、后台登录、后台运营接口、学生端页面、后台页面均通过。
- Git 自动部署已打开：`ENABLE_VERCEL_AUTODEPLOY=true`。

当前上线范围调整：

- 本轮先上线“手动输入 + AI 批改 + 题库/错题/后台运营”版本。
- 正式支付继续延期：`PAYMENT_LAUNCH_STRATEGY=deferred`。
- 拍照/相册识别继续延期：`OCR_LAUNCH_STRATEGY=deferred`。现有 DeepSeek `deepseek-v4-flash` 已验证不支持 `image_url`，不能作为拍照识别服务。

## 仍需配置的生产环境变量

Vercel 当前还没有任何项目环境变量。正式生产发布前必须在 Vercel Project Settings 或 CLI 中配置：

```text
TIXIAOZHU_ENV=production
VITE_ENABLE_API_FALLBACK=false
TIXIAOZHU_DATA_LAYER=postgres
DATABASE_URL=<production-postgres-url>
TIXIAOZHU_DATABASE_TABLE=tixiaozhu_store
ADMIN_USERNAME=<production-admin-username>
ADMIN_PASSWORD_HASH=<bcrypt-hash-from-admin-password>
ADMIN_SESSION_SECRET=<strong-random-secret>
STUDENT_SESSION_SECRET=<different-strong-random-secret>
REQUIRE_STUDENT_AUTH=true
PAYMENT_LAUNCH_STRATEGY=deferred
AI_PROVIDER=production-configured
AI_API_BASE=https://api.deepseek.com
AI_API_KEY=<production-ai-key>
AI_MODEL=deepseek-v4-flash
OCR_LAUNCH_STRATEGY=deferred
# OCR_API_URL=<production-recognition-endpoint> # 仅 OCR_LAUNCH_STRATEGY=production 时需要
BLOB_READ_WRITE_TOKEN=<vercel-blob-read-write-token>
VERCEL_ALERTS_ENABLED=true
# 可选：如果接入 Sentry，也可以继续设置 SENTRY_DSN=<sentry-dsn>
```

生成管理员密码哈希：

```bash
printf %s "$ADMIN_PASSWORD" | npm --prefix backend run admin:hash-password
```

生产数据库、Blob、监控、管理员哈希、学生会话密钥、DeepSeek AI、支付延期和 OCR 延期口径已配置到 Vercel Production。支付和 OCR 延期口径下，`/api/ready`、`preflight:production`、`smoke:production` 已通过。

部署 URL 确认后，还要补：

```text
FRONTEND_URL=https://<production-domain>
ADMIN_URL=https://<production-domain>/admin
CORS_ALLOW_ORIGIN=https://<production-domain>
```

如果学生端和后台分域部署，`ADMIN_URL` 和 `CORS_ALLOW_ORIGIN` 要写入两个正式域名。

## 不要做的事

- 不要把 `.env.deepseek.local` 上传到 Vercel 或提交到 Git。
- 不要用 `.env.production.example` 的占位值冒充生产配置。
- 不要在正式生产设置 `ALLOW_BLOCKED_PRODUCTION_START=true`。
- 不要在缺 PostgreSQL、对象存储或监控时把商业上线状态改成 Go。
- 不要用 mock OCR 或不支持图片的文本模型冒充拍照识别；如果本轮不做，必须设置 `OCR_LAUNCH_STRATEGY=deferred` 并隐藏入口。

## 剩余资源接入建议

推荐优先接：

```bash
# 1. 本轮 OCR 延期：生产环境隐藏拍照/相册识别入口。
npx vercel env add OCR_LAUNCH_STRATEGY production --value deferred --yes --force --no-sensitive

# 2. 所有 gate 通过后，打开 Git 自动部署；当前 Production 已设置。
npx vercel env add ENABLE_VERCEL_AUTODEPLOY production --value true --yes --force
```

## 最终上线门禁

生产环境变量配置完成后，先拉取并本地预检：

```bash
npx vercel pull --yes --environment=production
npm --prefix backend run preflight:production
```

部署后执行线上 smoke：

```bash
SMOKE_API_BASE=https://<production-domain>/api \
SMOKE_FRONTEND_URL=https://<production-domain> \
SMOKE_ADMIN_URL=https://<production-domain>/admin \
SMOKE_ADMIN_USERNAME=<production-admin-username> \
SMOKE_ADMIN_PASSWORD=<production-admin-password> \
npm --prefix backend run smoke:production
```

通过标准：

- `preflight:production` 返回 `ok: true`。
- `/api/ready` 返回 200。
- `smoke:production` 全部通过。
- 支付延期模式下，学生端不显示积分充值、会员购买或模拟支付成功入口。
- OCR 延期模式下，学生端不显示拍照/相册识别入口，`/api/recognition/config` 返回 `visible=false`。
