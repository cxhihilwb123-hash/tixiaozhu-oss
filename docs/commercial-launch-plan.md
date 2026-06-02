# 题小助商业上线修复计划

目标：从“可内测的正式化产品底座”推进到“可商业上线”的生产版本。判断标准不再是页面能跑或题库审计通过，而是用户、支付、数据、安全、内容和运维都具备上线闭环。

## 阶段判断

当前阶段：正式化内测版。

## 本轮上线策略

支付和拍照识别暂不纳入本轮修复范围，但生产环境也不能暴露测试支付或 mock 识别。

当前采用“双轨闸门”：

- 本轮商业上线：数据库、账号、安全、AI、对象存储、监控、正式域名必须满足上线标准。
- 支付商业化：标记为延期项，设置 `PAYMENT_LAUNCH_STRATEGY=deferred`，并保持 `paymentFeatureVisible=false`。
- 拍照识别：标记为延期项，设置 `OCR_LAUNCH_STRATEGY=deferred`，并隐藏生产环境拍照/相册识别入口。

这意味着本轮可以先发布非支付、手动输入版本或人工运营版本，但不能让 `testpay://`、模拟确认、mock OCR、默认账号、匿名学习数据进入生产。

上线前必须显式配置：

```bash
TIXIAOZHU_ENV=production
PAYMENT_LAUNCH_STRATEGY=deferred
FRONTEND_URL=https://正式学生端域名
ADMIN_URL=https://正式后台域名
CORS_ALLOW_ORIGIN=https://正式学生端域名,https://正式后台域名
DATABASE_URL=postgres://...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
STUDENT_SESSION_SECRET=...
REQUIRE_STUDENT_AUTH=true
AI_API_BASE=...
AI_API_KEY=...
AI_MODEL=...
OCR_LAUNCH_STRATEGY=deferred
OBJECT_STORAGE_BUCKET=...
SENTRY_DSN=... # 或 LOG_DRAIN_URL / OBSERVABILITY_ENDPOINT
```

验收命令：

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:commercial-launch
npm run build
```

当支付和 OCR 延期策略生效时，`audit:commercial-launch` 可以返回 `launch_ready`，但会保留 `deferredItems` 记录正式支付和拍照识别延期；如果生产环境误开启支付入口或用 mock OCR 冒充正式识别，审计仍会阻塞上线。

已经具备：

- 学生端、运营后台、后端 API 三端结构完整。
- 题库已形成教材同步、专项训练、试卷三层结构。
- 题库质量审计通过：`252` 个题包、`6912` 道题、`108` 个知识点。
- 已具备积分、题包购买、练习记录、错题、订单、支付会话、后台登录、本地持久化。
- 已有产品基线审计：`audit:product-readiness`。

未达到商业上线的原因：

- 数据仍是本地文件持久化，不是生产数据库。
- 后台仍允许默认管理员配置作为兜底。
- 管理员 token 使用本地默认 secret 作为兜底。
- 学生端没有真实账号体系与登录态。
- 支付仍是测试支付模式，没有真实支付网关、回调验签和退款审计。
- AI 仍是 mock-compatible 口径。
- OCR 如果纳入本轮上线，仍缺正式识别服务；本轮采用 `OCR_LAUNCH_STRATEGY=deferred` 延期。
- 上传文件、PDF、日志、监控没有接入生产对象存储和告警系统。

## P0 上线阻塞

1. 商业上线审计闸门

验收标准：

- 新增 `audit:commercial-launch`。
- 新增 `GET /api/commercial-launch-readiness`。
- 审计必须能明确区分：内测可用、上线阻塞、上线可发布。
- 默认管理员、测试支付、本地 JSON、mock AI/OCR、缺真实账号、缺对象存储、缺监控都必须被识别；其中支付和 OCR 允许以明确延期项放行，但不能暴露给真实用户。

2. 生产安全基线

验收标准：

- 管理员账号密码支持环境变量覆盖。
- 生产环境不能依赖默认 `admin/admin123`。
- 生产环境不能使用默认 `ADMIN_SESSION_SECRET`。
- 后台和学生登录接口具备基础失败次数限制。
- CORS 不能永远是 `*`，应按学生端和后台域名放行。

3. 数据层生产化

验收标准：

- 明确当前本地 JSON 只允许内测。
- 商业上线审计要求配置生产数据库连接。
- 后续迁移到 PostgreSQL 或等价生产数据库。
- 写操作具备可迁移的数据模型边界。

4. 支付生产化

验收标准：

- 测试支付不能被商业上线审计判定为 ready。
- 正式支付必须具备支付网关、回调验签、幂等处理、退款记录和异常订单处理。
- 后台不能直接随意改订单状态，订单状态应由支付/退款/履约动作驱动。

5. 用户账号与权限

验收标准：

- 学生端真实登录、注册、会话恢复。
- 用户练习、错题、收藏、购买记录绑定真实用户 ID。
- 后台管理权限和学生用户权限隔离。

## P1 产品能力

1. 题库内容运营流水线

- 题目人工审核、版本发布、回滚。
- 按知识点生成补弱包、专题包、试卷包。
- 题目质量抽检与老师编辑记录。

2. 学习闭环

- 根据错题和知识点掌握度推荐下一组题。
- 周报、月报、家长讲义稳定导出。
- 题包完成率、正确率、复练情况进入后台分析。

3. 商业运营

- 会员/积分定价策略。
- 首购转化、续费、题包解锁漏斗。
- 支付失败、退款、客服处理流程。

## P2 上线运维

1. 部署

- 前台、后台、后端分环境部署。
- 生产环境变量清单和密钥管理。
- 静态资源和 PDF 文件存储策略。

2. 监控

- API 错误监控。
- 支付回调告警。
- 登录异常告警。
- 题库导出失败告警。

3. 发布

- 上线前 smoke test。
- 回滚方案。
- 数据备份和恢复演练。

## 当前执行顺序

本轮先做：

1. 新增商业上线审计闸门。
2. 修复生产安全基线的一部分：管理员环境变量覆盖、登录失败限制、CORS 域名控制。
3. 把商业上线状态写入 API 和文档，后续每轮围绕 P0 阻塞项继续清。
