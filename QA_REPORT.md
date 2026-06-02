# 题小助 QA_REPORT

公开版说明：本报告保留历史 QA 结论和复现信息；原始截图、录屏和结构化运行结果属于本地生成产物，默认不随公开仓库发布，以避免误带入账号、学生数据、部署信息或其他隐私内容。需要复测时请运行 README 和 `docs/testing.md` 中的审计命令重新生成本地证据。

测试时间：2026-05-18 17:20-17:36 CST
测试身份：独立 QA，只读源码与运行项目，未修改业务代码
测试环境：本地开发环境，学生端 `http://127.0.0.1:5173/`，后台 `http://127.0.0.1:5174/`，API `http://127.0.0.1:8787/api`

## 结论

当前学生端、后台、API 基础链路可运行；题库质量审计与产品内测 readiness 通过。商业上线审计仍为 `blocked`，不能按真实商业生产环境放量。

本轮未发现 P0 级阻断崩溃；发现 P1 问题 2 个、P2 问题 1 个、P3 体验/可访问性问题 3 个。

## 测试证据

- 结构化步骤：`tests/qa-run-results.json`
- 截图目录：`tests/screenshots/`
- 录屏目录：`tests/videos/`
- 关键截图：
  - 首次进入：`tests/screenshots/01-student-first-visit-grade-selection.png`
  - 注册/登录：`tests/screenshots/04-student-register-empty-validation.png`、`tests/screenshots/05-student-registered-and-logged-in.png`、`tests/screenshots/06-student-login-wrong-password.png`
  - 完整练习：`tests/screenshots/07-practice-center.png`、`tests/screenshots/08-practice-question-1.png`、`tests/screenshots/09-practice-completion-report.png`
  - 错题：`tests/screenshots/13-wrong-question-workbench-final.png`
  - 拍题批改：`tests/screenshots/14-capture-correction-result-final.png`
  - 后台：`tests/screenshots/22-admin-dashboard-complete.png` 到 `tests/screenshots/30-admin-user-search-special-complete.png`
  - 移动端：`tests/screenshots/31-mobile-grade-selection-complete.png` 到 `tests/screenshots/36-mobile-我的-complete.png`

## 角色清单

| 角色 | 覆盖内容 | 结果 |
| --- | --- | --- |
| 访客/首次新用户 | 年级选择、昵称设置、刷新保持状态 | 通过 |
| 新学生账号 | 注册空值、注册成功、正式账号状态 | 通过 |
| 老学生账号 | 退出、错误密码、正确密码登录 | 通过 |
| 学生/练习用户 | 练习中心、空答案校验、完整题包提交、练习报告 | 通过 |
| 学生/错题用户 | 完整练习后进入错题工作台 | 通过 |
| 学生/拍题用户 | 手动输入、长文本/特殊符号、错误答案批改 | 部分通过，见 P1-02 |
| 学生/积分用户 | 个人中心、积分/会员入口、支付延期说明 | 部分验证 |
| 未授权管理员 | 后台未登录访问、错误登录 | 通过 |
| 管理员 | 登录、仪表盘、用户、题库、AI、知识点、记录、收费、系统设置 | 通过 |
| 移动端学生 | 390x844 首访、首页、练习、拍题、错题、我的 | 通过 |

## 执行过的 GUI 操作指令摘录

| 角色 | 操作类型 | 目标元素 | 预期结果 |
| --- | --- | --- | --- |
| 访客 | 打开 | 学生端首页 | 出现“先确定学习阶段” |
| 访客 | 点击 | “四年级”按钮、确认按钮 | 进入昵称输入 |
| 访客 | 输入 | 昵称输入框 | 可保存并进入首页 |
| 新学生 | 点击 | “我的”tab、“注册”按钮 | 出现注册弹窗 |
| 新学生 | 点击 | 空表单“创建账号并登录” | 显示失败提示 |
| 新学生 | 输入 | 昵称、手机号、密码 | 创建账号并显示“已登录正式账号” |
| 老学生 | 点击/输入 | 退出、登录、错误密码 | 显示登录失败 |
| 练习用户 | 点击 | “练习”tab、第一个“开始练习” | 进入第 1 题 |
| 练习用户 | 点击 | 空答案“提交答案” | 按钮禁用 |
| 练习用户 | 输入/点击 | 每题答案框、提交答案、下一题 | 完成题包并生成报告 |
| 拍题用户 | 点击 | “拍题”tab、“手动输入” | 进入手动输入流程 |
| 拍题用户 | 输入 | 长文本与特殊符号题干、错误答案 | 展示批改结果 |
| 未授权管理员 | 打开 | 后台首页 | 显示登录页 |
| 管理员 | 输入/点击 | 管理员账号密码、进入后台 | 进入仪表盘 |
| 管理员 | 点击/滚动 | 各后台菜单 | 页面可见、无白屏 |
| 移动端学生 | 点击/滚动 | 底部 tab | 页面可读、布局未明显遮挡 |

## 问题列表

### P1-01 商业上线审计仍为 blocked

严重程度：P1
类型：生产 readiness / 安全 / 运维
截图/录屏：无，命令输出证据

复现步骤：
1. 运行 `npm --prefix backend run audit:commercial-launch`
2. 查看返回结果

预期结果：如果作为商业生产环境发布，审计应为 `launch_ready` 或只剩明确延期项。
实际结果：审计返回 `readiness: blocked`，包含 8 个问题：本地文件数据层、默认管理员账号、默认会话密钥、学生强认证未开启、AI 测试口径、对象存储缺失、监控缺失、正式域名未配置。
修复建议：上线前接入 PostgreSQL/生产数据库，设置强管理员与 session secret，开启学生强认证，配置正式 AI、对象存储、监控、正式域名。支付和 OCR 可以延期，但必须继续隐藏真实用户入口。

### P1-02 手动输入题保存后拍题本未及时展示

严重程度：P1
类型：功能 / 数据沉淀 / 反馈
截图/录屏：`tests/screenshots/14-capture-correction-result-final.png`，相关视频在 `tests/videos/`

复现步骤：
1. 学生端完成 onboarding
2. 点击“拍题”
3. 点击“手动输入”
4. 输入长题干和特殊符号
5. 输入错误答案并点击“提交批改”
6. 点击“完成并存入拍题本”
7. 切换到“练习” -> “拍题本”

预期结果：拍题本立即出现刚保存的题，或显示明确的“已保存/同步失败”反馈。
实际结果：测试中 30 秒内未看到刚才的“边界题”，也没有明确成功反馈。
修复建议：检查 `CapturePage` 保存后的本地 store 更新、`PracticeCenterPage` 上传题筛选、用户作用域是否一致；保存成功后建议给出 toast，并提供“去拍题本查看”入口。

### P2-01 弹窗打开后底层按钮仍可被自动化/可访问树命中

严重程度：P2
类型：交互 / 可访问性
截图/录屏：`tests/screenshots/04-student-register-empty-validation.png`

复现步骤：
1. 进入“我的”
2. 点击“注册”打开注册弹窗
3. 使用全局角色选择器查找 `button: 登录`

预期结果：弹窗打开后，焦点和可访问树限制在弹窗内，底层页面控件不可聚焦。
实际结果：自动化先命中底层“登录”按钮，点击被遮罩拦截。
修复建议：弹窗打开时给背景容器设置 `inert` 或 `aria-hidden`，并实现焦点陷阱；自动化和屏幕阅读器都应只访问 `role=dialog` 内控件。

### P3-01 底部“错题”tab 与“错题强化”卡片存在名称前缀歧义

严重程度：P3
类型：自动化稳定性 / 可访问性
截图/录屏：`tests/screenshots/11-wrong-question-workbench-rerun.png`

复现步骤：在首页使用非精确 `button` 名称“错题”定位。
预期结果：底部导航可被唯一定位。
实际结果：会同时命中底部“错题”tab 和“错题强化”卡片。
修复建议：给底部导航增加稳定唯一 `aria-label` 或 `data-testid`，卡片使用更完整的描述。

### P3-02 批改页状态文案重复，自动化/辅助技术需额外区分

严重程度：P3
类型：文案 / 可访问性
截图/录屏：`tests/screenshots/14-capture-correction-result-final.png`

复现步骤：手动输入题后提交错误答案。
预期结果：主状态可以被唯一识别。
实际结果：页面同时存在标题“需要订正”和正文“答案需要订正...”，宽泛文本定位会命中多个节点。
修复建议：给主状态增加 `aria-live`/status 区域，正文避免重复完全相同短句，或增加更明确层级。

### P3-03 后台菜单文字与页面标题重复

严重程度：P3
类型：后台可测试性 / 可访问性
截图/录屏：`tests/screenshots/22-admin-dashboard-complete.png`

复现步骤：后台登录后查找“仪表盘中心”。
预期结果：主内容标题和侧边栏菜单可稳定区分。
实际结果：同一文案同时存在于侧边栏 button 和页面 h1。
修复建议：为主内容区域增加 `main` landmark 和 `aria-label`，自动化优先定位 main 内 heading。

## 已通过验证

- API `/health` 返回 OK。
- API `/ready` 返回 ready，当前为 development/file data layer，商业闸门显示 blocked 符合本地口径。
- `npm --prefix backend run audit:question-bank` 通过：252 题包、6912 题、108 知识点，重复题干/题包问题/题目问题均为 0。
- `npm --prefix backend run audit:product-readiness` 通过：`readiness: ready`，issueCount 为 0。
- 未授权访问 `/api/question-bank-quality` 返回管理员鉴权要求；带管理员 token 后可返回质检数据。
- 学生端首访、注册、登录、练习、错题、拍题批改基本可用。
- 后台登录、错误登录、主要菜单页面、用户搜索边界输入无白屏。
- 移动端 390x844 下首访、首页和底部主要 tab 可用。

## 未完全覆盖/剩余风险

- 未接入真实支付闭环，仅验证了支付延期/积分入口口径。
- 未接入真实 OCR/拍照识别，仅验证手动输入和批改。
- 后台“补发/扣减积分”的连续点击副作用未做最终数据核对，建议后续用 API 对账验证流水是否幂等。
- 多设备并发只做了刷新/返回/重复点击类破坏性操作，未做两个浏览器上下文同时编辑同一账号的冲突测试。
