# QA 问题修复复测记录

日期：2026-05-18

## 已修复

| QA 编号 | 问题 | 修复结果 | 复测证据 |
| --- | --- | --- | --- |
| P1-02 | 手动输入题保存后拍题本未及时展示 | 保存后直接切到练习中心的拍题本，并清空筛选；刚保存题目可立即看到 | Playwright 复测通过：`uploadVisible: true` |
| P2-01 | 弹窗打开后底层按钮仍可被命中 | Modal 改为 portal 渲染，打开时让 `#root` inert + `aria-hidden`，并加入 Tab 焦点陷阱 | Playwright 复测通过：`#root.inert=true`、`aria-hidden=true` |
| P3-01 | 底部错题 tab 与卡片名称歧义 | 底部导航增加稳定 `data-testid` 和更明确的 aria-label；首页快捷卡补充 aria-label | 构建通过 |
| P3-02 | 批改页状态文案重复 | 主结果标题增加 `role=status` / `aria-live`，正文反馈把重复前缀改成“订正建议” | 构建通过 |
| P3-03 | 后台菜单文字与页面标题重复 | 后台主内容增加 `aria-label="后台主内容"` 和 `data-testid="admin-main-content"` | Playwright 复测通过：main 内 heading 可定位 |

## 不能用代码直接完成的项

| QA 编号 | 问题 | 当前处理 |
| --- | --- | --- |
| P1-01 | 商业上线审计仍为 blocked | 不能用本地代码假装生产资源已配置。已补充 `docs/production-launch-blocker-remediation.md`，逐项列出真实生产数据库、强密钥、学生强认证、AI、对象存储、监控、正式域名的修复动作和验收命令。 |

## 复测命令

```bash
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
```

浏览器复测覆盖：

- 学生端手动输入题 -> 批改 -> 完成并查看拍题本 -> 刚保存题目可见
- 学生端注册弹窗 -> root 背景 inert/aria-hidden -> dialog 内按钮可见
- 后台登录 -> `admin-main-content` 内定位仪表盘标题
