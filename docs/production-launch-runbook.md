# 题小助生产上线 Runbook（支付与 OCR 延期版）

本 Runbook 适用于当前商业上线策略：先发布非支付、手动输入版本，正式支付和拍照识别延期上线。

## 1. 上线范围

本轮上线包含：

- 学生端：题库、练习、手动输入拍题、错题、收藏、学习记录、家长报告。
- 后台端：题库运营、用户与学习记录查看、内容审核、系统设置、商业上线审计。
- 后端：生产数据库、学生强认证、后台强认证、AI、PDF/导出、监控告警。

本轮不包含：

- 正式微信/支付宝收款。
- 积分充值。
- 会员购买。
- 支付回调、退款、对账。
- 拍照/相册 OCR 识别。

## 2. 必填生产环境变量

```bash
TIXIAOZHU_ENV=production
HOST=0.0.0.0
PORT=8787

FRONTEND_URL=https://app.example.com
ADMIN_URL=https://admin.example.com
CORS_ALLOW_ORIGIN=https://app.example.com,https://admin.example.com

# 同源部署可不设置 VITE_API_BASE，生产包会默认请求 /api。
# 多域名/API 网关部署时，构建前显式设置 VITE_API_BASE=https://api.example.com/api。
VITE_ENABLE_API_FALLBACK=false

TIXIAOZHU_DATA_LAYER=postgres
DATABASE_URL=postgres://user:password@host:5432/tixiaozhu
TIXIAOZHU_DATABASE_TABLE=tixiaozhu_store

ADMIN_USERNAME=ops-admin
ADMIN_PASSWORD_HASH=$2b$12$replace-with-real-bcrypt-hash
ADMIN_SESSION_SECRET=replace-with-64-byte-random-secret
ADMIN_LOGIN_MAX_ATTEMPTS=8
ADMIN_LOGIN_WINDOW_MS=600000

STUDENT_SESSION_SECRET=replace-with-different-64-byte-random-secret
STUDENT_SESSION_TTL_MS=2592000000
REQUIRE_STUDENT_AUTH=true
STUDENT_LOGIN_MAX_ATTEMPTS=10
STUDENT_LOGIN_WINDOW_MS=600000

PAYMENT_LAUNCH_STRATEGY=deferred

AI_PROVIDER=production-configured
AI_API_BASE=https://api.deepseek.com
AI_API_KEY=replace-with-deepseek-api-key
AI_MODEL=deepseek-v4-flash
OCR_LAUNCH_STRATEGY=deferred
# OCR_API_URL=https://ocr-provider.example.com/recognize # 仅 OCR_LAUNCH_STRATEGY=production 时需要

OBJECT_STORAGE_BUCKET=tixiaozhu-prod-assets
OBJECT_STORAGE_REGION=replace-with-region
OBJECT_STORAGE_ENDPOINT=https://storage.example.com
OBJECT_STORAGE_ACCESS_KEY=replace-with-access-key
OBJECT_STORAGE_SECRET_KEY=replace-with-secret-key

SENTRY_DSN=https://replace-with-sentry-dsn
# 或 LOG_DRAIN_URL / OBSERVABILITY_ENDPOINT
```

用下面的命令生成 `ADMIN_PASSWORD_HASH`，真实明文密码只进入标准输入，不提交到仓库：

```bash
printf %s "$ADMIN_PASSWORD" | npm --prefix backend run admin:hash-password
```

## 3. 部署前检查

如果需要先在本机验证 PostgreSQL 迁移链路，执行：

```bash
npm run db:local:start
npm run db:export:file
npm run db:import:local-postgres
npm run db:verify:local-postgres
npm --prefix backend run store:validate -- backend/data/postgres-verify-export.json
```

在生产环境变量注入后执行：

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm run audit:production-build
npm run audit:runtime-security
npm --prefix backend run audit:commercial-launch
npm --prefix backend run preflight:production
npm --prefix frontend audit --omit=dev
npm --prefix admin audit --omit=dev
npm --prefix backend audit --omit=dev
npm run build
```

通过标准：

- `audit:question-bank` 无重复、弱题、题包题量异常。
- `audit:product-readiness` 返回 `readiness: ready`。
- `audit:production-build` 构建学生端和后台端，并确认生产包没有本地 API、测试支付、默认账号、旧演示题包/订单/收入文案或 source map 残留。
- `audit:runtime-security` 自动启动隔离后端，验证匿名学生数据被拒绝、学生数据按账号隔离、未购买积分题包无法读题、支付延期入口关闭、后台运营接口需要管理员 token。
- `audit:commercial-launch` 返回 `readiness: launch_ready`。
- `audit:commercial-launch` 可以有 `deferredItems`，但只能是正式支付和拍照识别延期。
- `preflight:production` 能连通 PostgreSQL，确认强认证、支付延期、OCR 延期、AI、对象存储和监控配置。
- `preflight:production` 会拒绝 `replace-with-*`、`example.com`、`changeme`、`placeholder` 等占位配置；`.env.production.example` 只能作为模板，不能直接作为上线环境。
- 三端 `npm audit --omit=dev` 无生产依赖漏洞。
- `npm run build` 成功。

DeepSeek 本地验证：

```bash
cp .env.deepseek.local.example .env.deepseek.local
# 填入真实 AI_API_KEY 后执行
npm run verify:ai
```

通过标准：`verify:ai` 返回 `ok: true`，并能通过后台 `/api/ai/generate` 生成完整题目。

如需额外探测外部服务网络连通性，可以打开：

```bash
PREFLIGHT_PING_EXTERNALS=true npm --prefix backend run preflight:production
```

默认不 ping 外部服务，避免对 AI/OCR/对象存储供应商产生无意义请求；开启后脚本会用 `HEAD` 请求验证端点可达性。`OCR_LAUNCH_STRATEGY=deferred` 时不会要求 `OCR_API_URL`。

## 3.1 容器构建

项目根目录已提供 `Dockerfile`，会分别构建学生端、后台端并安装后端生产依赖。

```bash
docker build -t tixiaozhu:production .
docker run --env-file .env.production -p 8787:8787 tixiaozhu:production
```

注意：

- 不要把真实 `.env.production` 提交到仓库。
- 容器内仍需要注入本 Runbook 第 2 节的生产环境变量。
- `ALLOW_BLOCKED_PRODUCTION_START=true` 只能用于隔离 smoke test，正式生产不能设置。
- 生产构建不要设置 `VITE_ENABLE_API_FALLBACK=true`，否则前端可能在 API 失败时展示演示数据。
- 同源容器部署默认使用 `/api`，如前后端分域部署，构建学生端和后台端前必须设置正确的 `VITE_API_BASE`。

## 4. 生产启动检查

启动后检查：

```bash
curl -fsS https://api.example.com/api/health
curl -fsS https://api.example.com/api/ready
SMOKE_API_BASE=https://api.example.com/api \
SMOKE_ADMIN_USERNAME=ops-admin \
SMOKE_ADMIN_PASSWORD=replace-with-strong-password \
SMOKE_FRONTEND_URL=https://app.example.com \
SMOKE_ADMIN_URL=https://admin.example.com \
npm --prefix backend run smoke:production
```

健康检查口径：

- `/api/health`：进程存活即可返回 200，适合容器 liveness probe。
- `/api/ready`：静态站点、生产数据层、对象存储、监控、支付延期策略和商业上线闸门都通过才返回 200，适合 readiness probe。

后台登录：

- 使用 `ADMIN_USERNAME` 和生成哈希时对应的明文密码登录；部署环境只保存 `ADMIN_PASSWORD_HASH`。
- 不能使用 `admin/admin123`。

学生端检查：

- 未登录时，个人数据接口应要求登录。
- 注册/登录后，练习记录、错题、收藏、拍题沉淀必须绑定当前学生。
- 同昵称不同账号不应互相看到学习数据。
- 学生登录连续失败后应返回 `429`，防止弱口令撞库。
- 未购买的积分题包不能通过 `/api/questions?packId=...` 绕过前端限制直接读取题目。
- 后台运营接口必须要求管理员 token，包括知识点、学科成绩、题包版本、知识点讲义、积分规则和商业上线审计。

支付延期检查：

- 学生端不显示积分充值或会员购买入口。
- 直接打开购买页，只显示“支付入口暂未开放”。
- 生产环境调用 `/api/payments/session` 或 `/api/points/purchase` 应返回不可用。
- 生产支付延期模式下，未带管理员 token 的 `/api/membership-plans` 和 `/api/point-packages` 应返回空列表。
- `smoke:production` 应验证 `/api/payment/config` 返回 `paymentLaunchStrategy=deferred` 且支付/积分购买入口均为关闭，并验证公开套餐/积分包为空。
- `smoke:production` 应验证后台运营接口匿名访问被拒绝，包括知识点、学科成绩、题包版本、知识点讲义、积分规则和上线审计接口。
- 如提供 `SMOKE_ADMIN_USERNAME` / `SMOKE_ADMIN_PASSWORD`，`smoke:production` 还会登录后台并验证上述运营接口管理员可正常访问。
- 如配置 `SMOKE_FRONTEND_URL` / `SMOKE_ADMIN_URL`，`smoke:production` 还会验证学生端和后台 HTML 入口可达。

## 5. 回滚标准

出现以下情况应立即回滚：

- 商业上线审计不再是 `launch_ready`。
- 数据库写入失败或数据无法读取。
- 学生 A 能看到学生 B 的练习、错题、收藏或拍题数据。
- 后台默认账号可登录。
- 支付延期模式下出现模拟支付成功或积分充值成功。
- AI 大面积失败且没有降级提示。
- OCR 延期模式下拍照/相册识别入口重新暴露给生产用户。

## 5.1 备份与恢复

上线前导出当前数据层快照：

```bash
npm --prefix backend run store:export -- backend/data/prelaunch-store-backup.json
npm --prefix backend run store:validate -- backend/data/prelaunch-store-backup.json
```

恢复到目标数据层前，必须先校验快照：

```bash
npm --prefix backend run store:validate -- backend/data/prelaunch-store-backup.json
TIXIAOZHU_DATA_LAYER=postgres DATABASE_URL=postgres://... \
npm --prefix backend run store:import -- backend/data/prelaunch-store-backup.json
```

恢复原则：

- `store:import` 会先校验快照结构，校验失败不会写入目标数据层。
- 生产恢复前先导出当前生产快照，避免覆盖后无法回滚。
- 恢复后立刻执行 `audit:product-readiness`、`audit:commercial-launch` 和 `smoke:production`。

## 6. 支付恢复上线条件

未来要打开支付时，必须单独完成：

- `PAYMENT_LAUNCH_STRATEGY=production`
- `paymentFeatureVisible=true`
- `paymentMode=production`
- 正式商户参数配置
- 支付回调签名密钥
- 幂等事件记录
- 退款记录
- 对账/异常订单处理
- 支付回调告警

支付恢复后必须重新跑 `npm --prefix backend run audit:commercial-launch`，且不能再出现支付延期项。
