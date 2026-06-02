# 商业上线阻断项修复清单

更新时间：2026-05-18

本文件对应 QA 报告中的 `P1-01 商业上线审计仍为 blocked`。这些项目不能通过降低审计标准或把本地默认值伪装成生产值来修复；必须配置真实生产资源后再运行预检。

## 验收命令

```bash
npm --prefix backend run audit:commercial-launch
npm --prefix backend run preflight:production
```

如果需要同时验证外部服务连通性：

```bash
PREFLIGHT_PING_EXTERNALS=true npm --prefix backend run preflight:production
```

## 阻断项

| 阻断项 | 修复动作 | 关键配置 |
| --- | --- | --- |
| 本地文件数据层 | 接入 PostgreSQL 或等价生产数据库，并导入正式快照 | `TIXIAOZHU_DATA_LAYER=postgres`、`DATABASE_URL`、`TIXIAOZHU_DATABASE_TABLE` |
| 默认管理员账号 | 使用部署环境专用管理员账号和强密码 | `ADMIN_USERNAME`、`ADMIN_PASSWORD` |
| 默认管理员会话密钥 | 使用高强度随机字符串，且不得与学生端密钥相同 | `ADMIN_SESSION_SECRET` |
| 学生端强认证未开启 | 开启强认证，让练习、错题、收藏、购买记录绑定真实学生账号 | `STUDENT_SESSION_SECRET`、`REQUIRE_STUDENT_AUTH=true` |
| AI 测试服务口径 | 配置正式 AI 服务和模型 | `AI_API_BASE`、`AI_API_KEY`、`AI_MODEL` |
| 对象存储缺失 | 配置上传图片、PDF、导出物和备份的持久化存储 | `BLOB_READ_WRITE_TOKEN` 或 `OBJECT_STORAGE_*` |
| 监控告警缺失 | 配置错误监控、日志或平台告警 | `VERCEL_ALERTS_ENABLED=true` 或 `SENTRY_DSN` / `LOG_DRAIN_URL` / `OBSERVABILITY_ENDPOINT` |
| 正式域名未配置 | 显式配置前后台域名并加入 CORS 白名单 | `FRONTEND_URL`、`ADMIN_URL`、`CORS_ALLOW_ORIGIN` |

## 延期但必须安全隐藏

| 延期项 | 当前策略 | 验收要求 |
| --- | --- | --- |
| 正式支付 | `PAYMENT_LAUNCH_STRATEGY=deferred` | 生产环境不得暴露测试支付或模拟确认入口 |
| 拍照识别/OCR | `OCR_LAUNCH_STRATEGY=deferred` | 生产环境隐藏拍照/相册识别，保留手动输入链路 |

## 推荐执行顺序

1. 配置 PostgreSQL，运行数据导出、导入、反向导出校验。
2. 配置管理员和学生端强密钥，确认默认 `admin/admin123` 不再可用。
3. 配置正式域名和 CORS 白名单。
4. 配置 AI、对象存储、监控。
5. 保持支付和 OCR 延期策略，确认前台入口已隐藏。
6. 执行 `audit:commercial-launch` 和 `preflight:production`，直到全部通过。
