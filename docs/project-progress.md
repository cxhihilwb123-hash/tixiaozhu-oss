# 题小助项目进度与交接记录

更新时间：2026-04-28 23:35 CST

补充更新：2026-05-14 CST

- 学生端已按手机 / 平板 / 电脑做响应式改造，后台继续保持电脑端管理后台定位。
- 商业上线修复进入“支付和拍照识别延期、本轮可发布范围收口”阶段。
- 新增支付延期上线策略：`PAYMENT_LAUNCH_STRATEGY=deferred`。本轮不接正式支付，但生产环境必须关闭前台支付入口，不能暴露测试支付或模拟支付确认。
- 新增拍照识别延期上线策略：`OCR_LAUNCH_STRATEGY=deferred`。本轮不接正式 OCR/视觉识别，生产环境必须隐藏拍照/相册识别入口，保留手动输入、AI 批改、题库、错题和后台运营链路。
- 商业上线审计现在会把正式支付和拍照识别列为 `deferredItems`，继续阻塞数据库、默认管理员、默认密钥、学生强认证、AI、对象存储、监控和正式域名等本轮上线项。
- 后端生产 CORS 已改为学生端和后台域名白名单动态放行，避免后台独立域名上线后被生产 CORS 拦截。
- 新增生产预检脚本：`npm --prefix backend run preflight:production`，用于上线前真实检查商业审计、PostgreSQL、强认证、支付延期、OCR 延期、AI、对象存储和监控配置。
- 生产预检现在会拒绝占位环境变量，包括 `replace-with-*`、`example.com`、`changeme`、`placeholder`、`dummy`、`fake`，避免示例配置伪装成正式配置。
- PostgreSQL 接入已从“代码支持”推进到可执行链路：新增本地 Postgres 启停、文件快照导出、导入 Postgres、从 Postgres 反向导出验证命令；本地容器已验证 `252` 题包、`6912` 题、`108` 知识点和 `5` 用户可写入并从 PostgreSQL 读取；生产模式后端使用 PostgreSQL 数据层启动时 `/api/ready` 返回 200，`dataLayer=postgres`，商业闸门为 `launch_ready`。
- DeepSeek AI 出题服务已配置并验证：新增 `npm run verify:ai`，本地 `.env.deepseek.local` 使用 `AI_API_BASE=https://api.deepseek.com` 和 `AI_MODEL=deepseek-v4-flash`；真实调用后台 `/api/ai/generate` 已返回完整题目，不再是 mock 生成。
- 新增生产 smoke 脚本：`SMOKE_API_BASE=https://api.example.com/api npm --prefix backend run smoke:production`，用于部署后验证健康检查、支付延期、学生接口强认证和后台审计鉴权。
- 新增 Dockerfile 与 `.dockerignore`，并已验证本地镜像 `tixiaozhu:local-check` 可成功构建。
- 后端现在可直接服务构建后的静态站点：`/` 为学生端，`/admin/` 为管理后台；容器单服务部署不会再只有 API。
- 新增 `/api/ready` 就绪检查：生产环境下会确认静态入口、PostgreSQL 数据层、支付延期策略和商业上线闸门，适合部署平台 readiness probe。
- `store:export` / `store:import` 现在会走快照结构校验；新增 `store:validate`，用于生产备份恢复前防止坏 JSON 覆盖数据库。

## 新线程接续提示

新线程可以直接说：

```text
继续 /Users/forkman03/Share/tixiaozhu/tixiaozhu 项目。先读取 docs/project-progress.md，再检查当前代码和运行状态。当前重点是把题库产品继续做成“教材同步 / 专项训练 / 试卷”的成体系练习产品。
```

## 当前项目定位

题小助正在从原型向真实业务产品推进。当前仍是本地内存数据和测试支付模式，但业务模型按正式产品设计：

- 学生端：拍题、练习、错题、题库商城、积分余额。
- 管理后台：用户、习题内容、知识点、AI 出题、学习记录、收费与积分、系统设置。
- 题库产品方向：只做考试主科，不做副科内容堆叠；题库必须像教辅/练习产品一样成体系。

## 当前运行地址

- 学生端：`http://127.0.0.1:5173/`
- 管理后台：`http://127.0.0.1:5174/`
- API：`http://127.0.0.1:8787/api`
- API 健康检查：`http://127.0.0.1:8787/api/health`

后台当前已经补上基础登录门槛。对外测试口径可暂用：

- 账号：`admin`
- 密码：`admin123`

注意：当前是本地测试管理员认证，不是完整生产级权限系统，但已经具备后台登录页、会话恢复和关键管理写接口鉴权。

## 常用命令

```bash
cd /Users/forkman03/Share/tixiaozhu/tixiaozhu
npm run build
npm --prefix backend run start
npm --prefix frontend run dev
npm --prefix admin run dev
```

当前本地常用端口：

- frontend Vite：`5173`
- admin Vite：`5174`
- backend API：`8787`

如果页面显示旧数据，优先检查是否有旧进程占用端口：

```bash
lsof -ti tcp:5173
lsof -ti tcp:5174
lsof -ti tcp:8787
```

新增正式基线检查命令：

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run reset:store
npm run db:local:start
npm run db:export:file
npm run db:import:local-postgres
npm run db:verify:local-postgres
npm run verify:ai
```

## 已完成模块

### 1. 积分模式

已从单纯会员/支付模型推进为“积分充值 + 题包解锁”的模式。当前商业规则已收口：除了购买/解锁题包之外，拍题识别、AI批改、提示讲解、错题复练和学习报告都不扣积分。

后端已有：

- 积分账户：`GET /api/points/account`
- 积分包：`GET /api/point-packages`
- 积分规则：`GET /api/point-rules`
- 积分流水：`GET /api/point-transactions`
- 积分购买：`POST /api/points/purchase`
- 题包解锁：`POST /api/content-purchases/buy`
- 后台调账：`POST /api/admin/points/adjust`

前台已有：

- 首页/个人页显示积分余额。
- “我的/会员页”已经偏向积分中心。
- 题库商城可以用积分解锁内容。
- 拍题、提示、批改、错题复练和学习报告不再扣积分。

后台已有：

- 收费与积分页展示积分包、积分流水、用户余额和调账能力。
- 系统设置中保留 `monetizationMode: points`、`pointsFeatureVisible: true`。

### 2. 题库商城

题库商城已从练习列表拆成独立页面：

- 文件：`frontend/src/pages/QuestionStorePage.jsx`
- 入口：练习中心顶部“去题库商城买新题包”
- 业务链路：商城负责买题，练习中心负责练题
- 购买接口：`POST /api/content-purchases/buy`
- 已购买内容：`GET /api/content-purchases`

当前逻辑：

- 免费题包可直接练。
- 积分题包购买后进入“我的题库”。
- 积分不足会提示先到“我的”购买积分包。
- 从商城页开始练习会自动退出商城状态。

### 3. 练习中心

练习中心当前职责：

- 我的题库：只展示免费/已解锁题包。
- 拍题本：展示拍照上传、手动输入沉淀的个人题。
- 错题回收：按知识点生成错题专项小卷。

文件：

- `frontend/src/pages/PracticeCenterPage.jsx`

注意：练习中心不应该再塞购买逻辑，购买只放题库商城。

### 4. 拍题本

拍照上传/手动输入题目已经能沉淀到拍题本。

后端接口：

- `GET /api/uploaded-questions`
- `POST /api/uploaded-questions`

前端状态：

- `frontend/src/stores/index.js` 中的 `useUploadStore`

前端页面：

- `frontend/src/pages/CapturePage.jsx`
- `frontend/src/pages/PracticeCenterPage.jsx`

当前能力：

- 完成拍题后保存题目。
- 拍题本能选择多题生成小卷。
- 单题可直接练。
- 后台“习题内容”有“拍题沉淀”tab。

### 5. 错题工作台

错题功能已从简单列表升级为错题工作台。

文件：

- `frontend/src/pages/WrongQuestionPage.jsx`
- `frontend/src/stores/index.js` 中的 `useWrongQuestionStore`

当前能力：

- 按学科、知识点、状态筛选。
- 支持搜索、排序、批量选择。
- 支持生成自定义错题小卷。
- 支持标记掌握、移除错题。
- 练习后按知识点回收。

### 6. 小学主科题库体系

最新重点：题库已经从“题目堆叠”重构为主科考试题库体系。

文件：

- `backend/src/elementary-question-bank.js`
- `backend/src/seed-data.js`
- `frontend/src/utils/constants.js`
- `admin/src/pages/QuestionsPage.jsx`
- `admin/src/pages/KnowledgePage.jsx`
- `admin/src/pages/AIPage.jsx`

当前只保留小学考试主科：

- 数学
- 语文
- 英语

副科已从题库种子和前台学科选项中移除：

- 科学
- 道德与法治
- 信息科技
- 劳动
- 音乐
- 美术
- 体育与健康

当前题库产品线：

- `教材同步`：按年级、上册/下册、单元同步练。
- `专项训练`：按能力模块训练，如计算能力、阅读理解、句型语法、习作表达。
- `试卷`：上册单元卷、上册期末卷、下册单元卷、下册期末卷。

当前生成规模：

- 252 个题包。
- 6912 道单题。
- 108 个知识点。
- 108 个教材同步题包。
- 72 个专项训练题包。
- 72 套试卷。

当前题库质量口径：

- 默认来源已升级为“自研精品题库”，不是商业教辅搬运题。
- 每道题带能力标签、答题方法、常见易错点、质量分、审核状态和来源策略。
- 教材同步每包 24 题；专项训练每包 28 题；试卷每套 32 题。
- 后端新增 `npm --prefix backend run audit:question-bank`，用于统计题量、题型体系、质量字段完整度和题包题量一致性。
- 后台“习题内容中心”新增题库质检看板，对接 `GET /api/question-bank-quality`，自动检查题量、来源、质量字段、重复题干、审核状态和低覆盖题包。
- 当前 6912 道题精确题干去重为 0 组重复，避免题库只是模板重复堆量。

后台“习题内容”现在展示：

- 体系：教材同步 / 专项训练 / 试卷。
- 学科：数学 / 语文 / 英语。
- 年级。
- 册/单元。
- 训练结构。
- 覆盖范围。
- 来源：课程种子库。

后端已收口：正式题库接口不再混入老的初中/副科演示题包。

### 7. 题库分层管理与商城筛选

已按“教材同步 / 专项训练 / 试卷”的产品体系继续推进前后台视图。

后台“习题内容中心”已从单纯表格筛选升级：

- 左栏：题库体系，展示教材同步、专项训练、试卷的题包数、题量和发布数。
- 中栏：年级与学科，只围绕小学主科定位内容。
- 右栏：教材同步按册次、单元筛选；专项和试卷按训练产品预览。
- 表格仍保留搜索、体系、年级、学科、状态筛选，用于运营明细核对。
- 后台离线 fallback mock 已同步去掉初中/物理等旧演示口径，避免 API 未启动时误导。

学生端“题库商城”已同步改为分层筛选：

- 先选年级。
- 再选数学 / 语文 / 英语。

### 8. 正式产品基线审计

为了继续把项目往“正式可卖的教育产品”推进，新增了一层不只看题量的基线审计：

- 后端新增 `GET /api/product-readiness`
- 后端新增 `npm --prefix backend run audit:product-readiness`
- 管理后台仪表盘新增“正式产品基线”卡片

这层检查会盯住：

- 用户样本是否仍混入初中/高中或副科演示数据
- 学习记录是否引用真实存在的当前题库题包
- 错题、AI 出题历史、内容购买、积分流水是否和小学主科正式题库一致

本次同时把内存种子业务数据统一回小学主科口径，避免后台、商城、推荐、积分和仪表盘继续被旧 demo 样本污染。

### 9. 本地持久化底座

为了解决“后端重启后数据全部回到 seed”的原型问题，后端已新增本地文件持久化层：

- 文件位置：`backend/data/store.json`
- 默认会持久化：积分、题包购买、订单支付、练习记录、错题状态、拍题沉淀、收藏、后台设置、题包调题版本
- 服务退出时会主动 flush，尽量避免最近一笔写操作丢失

这一步的意义：

- 项目不再是纯一次性演示内存态
- 可以更真实地连续验证“买题包 -> 做题 -> 出错题 -> 改状态 -> 重启服务”整条链路
- 为后面切真实数据库前先把数据对象和写路径稳定下来

开发重置方式：

```bash
npm --prefix backend run reset:store
```

### 10. 后台基础认证

为了把后台从“任何人打开地址都能进”的原型态继续往正式项目推进，本次新增：

- 后端登录接口：`POST /api/admin/auth/login`
- 后端会话校验：`GET /api/admin/auth/session`
- 前端后台登录页与本地会话恢复
- 关键后台写接口鉴权：题包调题、题包改价/改状态、后台调账、系统设置修改、AI出题提交审核

当前默认本地测试账号：

- 账号：`admin`
- 密码：`admin123`

定位说明：

- 这还不是最终生产级 RBAC，但已经不再是裸奔后台
- 现阶段足够支撑本地演示、运营验证和后续继续切真实账号体系

### 11. 专业题库 schema 升级

为了把题库从“有很多题”继续推进到“专业、丰富、可持续领先”的产品形态，本次又把题库 schema 和质检升级了一层：

- 题包新增：`productPositioning`、`suitableScene`、`diagnosticFocus`、`prerequisite`、`learningObjectives`、`targetAbility`、`curriculumTags`、`editorialHighlights`
- 单题新增：`domain`、`cognitiveLevel`、`scenarioType`、`literacyDimension`、`answerTemplate`、`parentTip`、`scoringRubric`、`distractorAnalysis`、`curriculumNode`、`sourceBlueprint`
- 题库质检新增：领域分布、认知层级分布、场景分布、专业字段完整度检查
- 后台“习题内容中心”已能直接看到这些专业维度

当前验证结果：

- `GET /api/question-bank-quality` 已返回 `domainCount: 11`、`cognitiveLevelCount: 5`、`sceneTypeCount: 12`
- 题库审计继续通过，仍保持 `252` 包、`6912` 题、`108` 知识点
- 这让后续扩题不再只是堆量，而是可以按“教材同步 / 专项突破 / 阶段诊断”与“识记 / 理解 / 应用 / 迁移 / 综合”来运营

### 12. 知识点覆盖分析与专项补齐

本轮继续往“领先行业题库”推进，不只补字段，还补了知识点覆盖分析层：

- 后端新增：`GET /api/question-bank-coverage`
- 后台“题库与知识点中心”已能直接看到每个知识点的覆盖分、教材/专项/试卷覆盖、认知层级覆盖和补题提醒

这层分析发现了一个真实问题：

- 原先有 `54` 个知识点缺少“专项训练”覆盖

随后已直接修复专项题包的知识点映射逻辑，让专项训练不再只覆盖部分知识点，而是进入全年级核心知识点链路。修复后的验证结果：

- `knowledgePoints: 108`
- `averageCoverageScore: 100`
- `leadingCount: 108`
- `missingSeriesPoints: 0`

这意味着当前所有知识点都已经进入：

- 教材同步
- 专项训练
- 试卷诊断

三层产品链路。后续再扩题时，应继续围绕“覆盖质量、认知梯度、题型结构、家长打印与讲评场景”去做，而不是只追求数量。

补充说明：

- 这次没有把“专项训练”做成全知识点混装大杂烩
- 当前专项包已经按主题重新聚焦，例如 `四年级数学计算能力专项` 会聚焦 `三位数乘两位数 / 运算律 / 小数初步认识`
- 也就是说，现在实现的是“全库覆盖完整”与“单包主题明确”同时成立

### 13. 难度梯度与掌握路径

为了进一步向“高标准题库”靠拢，本轮又补了一层很关键的专业结构：

- 单题新增：`difficultyTier`、`masteryStage`、`variantType`
- 题库审计新增：难度梯度分布、掌握阶段分布
- 后台“习题内容中心”和“题库与知识点中心”已能直接看到这些梯度

当前验证结果：

- 全库 `difficultyTiers` 已形成 `基础巩固 / 方法进阶 / 迁移提升 / 压轴突破`
- 全库 `masteryStages` 已形成 `入门识别 / 基础掌握 / 方法迁移 / 综合突破 / 诊断回收 / 压轴突破`
- 抽样验证 `四年级数学上册第1单元同步练` 已具备完整梯度与变式链

这意味着题库已经不只是“有题、有覆盖”，而是开始具备：

- 清晰的学习进阶路径
- 同知识点的梯度训练链
- 适合后续做自适应推荐、错题回收、分层讲评的底座
- 再选教材同步 / 专项训练 / 试卷。
- 教材同步下继续按上册、下册、单元定位题包。
- 题包卡片显示体系、学科、年级、册次/单元或覆盖范围。

### 8. 题包详情页

已补上题包详情能力，避免后台和学生端只停留在题包列表。

后台“习题内容中心”：

- 可从右侧训练产品卡片或表格眼睛按钮选中题包。
- 详情区展示体系、发布状态、来源、年级、学科、册次/单元。
- 展示题量、积分价格、使用次数、完成率。
- 展示训练结构、知识点覆盖、题型分布。
- 展示题目预览，包含题干、题型、难度、知识点和答案。

学生端“题库商城”：

- 已购题包增加“题目预览”入口。
- 未购题包可先看题目预览。
- 弹窗展示体系、学科、年级、价格、用时、训练结构、知识点覆盖、题型分布和题目预览。
- 题目预览、购买题包、开始练习三类动作已分离，预览弹窗内只看内容，不承载购买或练习按钮。

### 9. 学生端商城推荐与分组

学生端“题库商城”已继续从长列表升级为更接近真实练习产品的分组结构：

- 新增“题包分组”切换：我的年级推荐 / 已入库 / 免费可练 / 积分解锁 / 全部。
- 默认优先展示推荐题包。
- 推荐逻辑优先使用当前手动选择的年级，否则使用学生档案年级。
- “全部”模式下按推荐、已入库、免费可练、积分解锁分区展示，并避免重复出现同一个题包。
- 题包卡片增加“年级推荐”标识，帮助学生快速识别适合当前年级的内容。
- 顶部统计从“积分题包”调整为“当前年级推荐 / 已入库 / 积分余额”，更贴近学生选题场景。

### 10. 后台题包运营动作

后台“题包详情”已从只读详情继续推进为可操作的运营工作台。

后端新增：

- `PATCH /api/question-packs/:id`：更新题包状态、积分价格、访问方式、训练结构和覆盖范围。
- `PATCH /api/questions/:id`：调整题目所属题包，支持移出当前题包或调入目标题包。
- 调题后会刷新受影响题包的 `questionCount`。

后台新增能力：

- 题包详情可直接发布/下架。
- 可编辑积分价格，价格为 0 时自动改为免费，大于 0 时自动改为积分解锁。
- 可查看全部题目，不再只看前 8 题预览。
- 新增“调题工作台”：左侧显示当前题包题目并支持移出，右侧按同年级同学科筛选可调入题目。
- 调题操作会更新前端题目列表和题包题量。

### 11. 题目质量细化

题库种子题已从“方法提醒式模板”升级为更像真实练习题的可作答题目。

`backend/src/elementary-question-bank.js` 已调整：

- 数学题根据知识点生成具体计算、面积、分数、统计、百分数、比例和应用题。
- 语文题加入短文阅读、关键词分析、造句和习作片段表达。
- 英语题加入语境选择、填空、阅读问答和简单表达。
- 选择题现在有更具体的选项和明确答案。
- 填空题、简答题、应用题都有可对照答案和解析。
- 仍保持 252 个题包、2448 道题、数学/语文/英语三科主科范围不变。

`backend/src/server.js` 中后台 AI 出题接口也同步优化：

- 数学生成具体应用题/计算题。
- 语文生成具体阅读句子与简答。
- 英语生成具体语境选择、填空和阅读问答。

### 12. 后端权威判题与报告生成

练习完成链路已从“前端计算分数、后端记录结果”推进为“前端提交答案、后端权威判题并生成报告”。

当前规则：

- 前端每题即时批改仍调用 `POST /api/answers/grade`，但会把题目信息一起提交，后端不再找不到题时随便拿其他题兜底。
- 练习完成时，前端提交用户答案、题包信息和题目元数据。
- `POST /api/practice-records` 会在后端逐题重新判定 `isCorrect`、计算 `correct / wrong / score / accuracy`。
- 学习报告中的综合评价、薄弱知识点、家长摘要和下一步建议以后端结果为准。
- 错题写入、题包使用次数、用户正确率和完成练习奖励都基于后端生成的练习记录。
- 前端保留本地报告作为接口失败兜底，但正常链路不再相信前端传入的 `score / correct / isCorrect`。

积分规则也已同步收口：

- 只有购买/解锁题包会消耗积分。
- 拍题识别、AI批改、提示讲解、错题复练、收藏题目和学习报告都不扣积分。
- 旧的 `/api/points/spend` 不能再单独扣 `ocr / grade / hint`，如要消耗积分必须走题包购买链路。

### 13. 错题掌握状态机

错题功能已从简单 `mastered: true/false` 升级为四段式掌握状态：

- `new`：新错题，刚答错或再次答错后回到此状态。
- `corrected`：已订正，错题复练答对后进入此状态。
- `reviewing`：复练中，用户主动把错题加入复练或错题小卷后进入此状态。
- `mastered`：已掌握，用户确认掌握或多次复练正确后进入此状态。

后端新增：

- `PATCH /api/wrong-questions/:id`：更新错题状态。
- `GET /api/wrong-questions` 会返回 `status` 和 `statusLabel`，并兼容旧的 `mastered` 字段。
- `POST /api/practice-records` 在后端权威判题后，会根据答题结果自动推进错题状态。

前台新增：

- 错题页顶部统计改为新错题、已订正、复练中、已掌握。
- 错题筛选新增状态筛选：待处理 / 新错题 / 已订正 / 复练中 / 已掌握 / 全部。
- 错题详情支持标记已订正、标记已掌握。
- 批量操作支持生成小卷、标记订正、标记掌握、移除。

后台新增：

- 学习记录与错题中心显示错题阶段，不再只显示“待强化/已掌握”。

## 14. 题包推荐理由

题包推荐不再只按年级筛选，而是形成面向家长可解释的推荐结果。

后端新增：

- `GET /api/question-packs?user=...` 返回每个题包的 `recommendation`。
- `recommendation.reasons` 会综合年级匹配、活跃错题、近期薄弱知识点、同科正确率生成。
- `recommendation.level` 分为 `high / medium / normal`，前端显示为强推荐 / 适合练 / 可选练。

前台新增：

- 题库商城卡片展示推荐理由，购买前即可看到为什么推荐。
- 题包预览弹窗展示推荐理由、训练结构、知识点覆盖、题型分布和题目预览。
- 练习中心的已入库题包同样展示推荐理由，方便家长判断下一轮练什么。

## 15. 家长报告汇总

“我的 / 学习记录”不再只是单条流水，打开后会先看到一块家长报告汇总。

前台新增：

- 近 7 天完成轮次和正确率。
- 近 30 天总题量。
- 待回收错题数和已掌握错题数。
- 错题回收率。
- 最近 6 轮练习正确率趋势。
- 从学习记录和活跃错题里提取重点关注知识点。
- 按学科汇总完成轮次和正确率。
- 自动生成下一步建议：先回收错题、做年级推荐题包、做薄弱专项或进入检测卷。
- 支持导出周报和月报文本，家长可以直接转发查看。

后端新增：

- `GET /api/learning-report?user=...&period=week|month`：统一生成家长周报 / 月报。
- 报告内容包含周期、总体表现、学科表现、重点关注、最近练习和下一步建议。

## 16. 后台题包运营工作台

后台“习题内容 / 题包管理”从单题手动调入调出，升级为更接近运营后台的题包工作台。

后端新增：

- `POST /api/question-packs/:id/questions/bulk`：批量调入或批量移出题目。
- `PATCH /api/question-packs/:id/questions/reorder`：保存题包内题目排序。
- `GET /api/question-packs/:id/versions`：查看题包变更记录。
- 题包状态、价格、批量调题、排序都会生成 `questionPackVersions` 版本记录。
- `GET /api/questions?packId=...` 按 `sortOrder` 返回题目，保证学生端预览和练习顺序一致。

后台新增：

- 当前题包题目支持勾选和批量移出。
- 可调入题目支持勾选和批量调入。
- 题目预览列表支持上移 / 下移。
- 题包详情底部显示最近版本记录，能看见发布、调题、排序和价格变化痕迹。

## 当前重要接口

```text
GET  /api/health
GET  /api/dashboard
GET  /api/question-packs
GET  /api/question-packs/:id/versions
GET  /api/questions
GET  /api/questions?packId=primary-g4-math-u1
GET  /api/knowledge-points
GET  /api/learning-report
GET  /api/uploaded-questions
POST /api/uploaded-questions
GET  /api/wrong-questions
POST /api/practice-records
GET  /api/points/account
GET  /api/point-packages
GET  /api/point-rules
GET  /api/point-transactions
POST /api/points/purchase
GET  /api/content-purchases
POST /api/content-purchases/buy
POST /api/admin/points/adjust
PATCH /api/question-packs/:id
POST  /api/question-packs/:id/questions/bulk
PATCH /api/question-packs/:id/questions/reorder
PATCH /api/questions/:id
PATCH /api/wrong-questions/:id
```

## 最近一次验证

时间：2026-04-27 22:08 CST

已验证：

- `npm run build` 通过。
- `node --check backend/src/elementary-question-bank.js`
- `node --check backend/src/seed-data.js`
- `node --check backend/src/server.js`
- API `GET /api/question-packs` 返回 252 个题包。
- API `GET /api/questions` 返回 2448 道题。
- API 题包学科只包含 `数学 / 语文 / 英语`。
- API 题包体系为 `textbook / special / paper`。
- API 题包体系数量为教材同步 108、专项训练 72、试卷 72。
- 后台“习题内容”页显示 252 个训练题包、2448 道单题。
- 后台“习题内容”页可见体系筛选：教材同步 / 专项训练 / 试卷。
- 学生端源码服务可见“先选年级 / 教材层级 / 全部单元”。
- 后台源码服务可见“题库体系 / 年级与学科 / 全部单元”。
- API `GET /api/questions?packId=primary-g4-math-u1` 返回 8 道题，题目含题型、知识点、答案和解析。
- 学生端源码服务可见“题包详情 / 知识点覆盖 / 题目预览”。
- 后台源码服务可见“训练结构 / 知识点覆盖 / 题型分布 / 题目预览 / 查看题包详情”。
- 学生端源码服务可见“题包分组 / 我的年级推荐 / 免费可练 / 积分解锁 / 年级推荐”。
- API 题包按四年级抽样：推荐 42 个、已入库 108 个、免费 108 个、积分解锁 144 个。
- `npm run build` 再次通过。
- `node --check backend/src/elementary-question-bank.js && node --check backend/src/seed-data.js && node --check backend/src/server.js` 再次通过。
- 临时启动 API 后验证 `PATCH /api/question-packs/primary-g4-math-u1`：状态可改为 `draft`、价格可改为 9、访问方式变为 `points`。
- 临时启动 API 后验证 `PATCH /api/questions/:id`：移出题目后该题包题量从 8 变 7，恢复后回到 8。
- 后台源码服务可见“查看全部题目 / 保存价格 / 调题工作台”。
- 题库种子抽样验证：总量仍为 252 个题包、2448 道题，学科仍只包含数学/语文/英语。
- 抽样验证 `primary-g4-math-u1`：数学题含具体口算、填空、两步应用题和解析。
- 抽样验证 `primary-g5-chinese-special-2`：语文题含短文阅读、造句、关键词分析和习作表达。
- 抽样验证 `primary-g6-english-paper-2`：英语题含过去时选择、地点填空、阅读问答和表达题。
- 临时启动 API 后验证 `/api/ai/generate`：数学、语文、英语均返回具体题干、答案和解析。
- `npm run build` 再次通过。

追加验证：2026-04-28 09:30 CST

- `npm run build` 通过。
- `node --check backend/src/server.js && node --check backend/src/seed-data.js` 通过。
- 临时 API 验证：向 `POST /api/practice-records` 提交伪造的 `correct/score/isCorrect`，后端仍按题库答案重新计算分数。
- 临时 API 验证：`POST /api/points/spend` 使用 `grade` 返回 `400`。
- 临时 API 验证：`POST /api/content-purchases/buy` 仍可正常购买题包并生成积分流水。
- 临时 API 验证：`PATCH /api/wrong-questions/:id` 可将错题更新为 `corrected` 和 `mastered`。
- 临时 API 验证：先答错再答对同一道错题，错题状态自动从 `new` 推进到 `corrected`。

追加验证：2026-04-28 09:45 CST

- `npm run build` 通过。
- `node --check backend/src/server.js && node --check backend/src/seed-data.js` 通过。
- `npm run check:api` 通过。
- API `GET /api/question-packs?user=小明` 返回 `recommendation.reasons` 和 `recommendation.level`。
- 学生端题库商城与练习中心均已接入题包推荐理由。
- 学生端“我的 / 学习记录”已接入家长报告汇总。

追加验证：2026-04-28 09:55 CST

- `npm run build` 通过。
- `node --check backend/src/server.js && node --check backend/src/seed-data.js` 通过。
- `npm run check:api` 通过。
- 临时 API 验证：`POST /api/question-packs/:id/questions/bulk` 可批量调入题目，题包题量从 8 变 9。
- 临时 API 验证：`PATCH /api/question-packs/:id/questions/reorder` 可调整题目顺序。
- 临时 API 验证：`POST /api/question-packs/:id/questions/bulk` 可批量移出题目。
- 临时 API 验证：`GET /api/question-packs/:id/versions` 返回批量调入、排序、批量移出三条版本记录。
- 后台页面验证：习题内容页可见上移 / 下移和题包版本记录。
- 学生端“我的 / 学习记录”已补正确率趋势和错题回收率。

追加验证：2026-04-28 10:05 CST

- `GET /api/learning-report?user=小明&period=week` 返回可导出的周报文本。
- 学生端“我的 / 学习记录”已增加导出周报 / 导出月报。

## 需要特别记住的产品判断

用户明确反馈：

> 题库不能只是很多题堆在一起，要像学霸练习一样，有跟着教材来的，有专项训练，有卷子。课程只要考试课程，其他副科不需要。

后续所有题库工作都要围绕这个判断推进：

- 不要把题库做成“按学科平铺的一堆题包”。
- 不要扩副科。
- 不要只做“全册基础题库”这种粗分类。
- 要像教辅/练习 App：教材同步是主线，专项训练补能力，试卷做检测。
- 后台应该继续从表格筛选升级为更清晰的层级视图。

## 下一步建议

优先级从高到低：

1. 家长端报告继续细化：补报告图片/PDF样式、错题回收率趋势按周展示。
2. 后台题包运营继续细化：补题包复制、版本回滚、批量发布/下架。
3. 题目质量继续细化：按具体年级继续补更多真实学科题型，例如数学竖式/几何图形、语文非连续文本、英语完形/阅读匹配。
4. 正式登录系统仍未做：后台现在无登录拦截，测试账号只是口径。
5. 当前仍是内存数据服务，正式化需要接数据库，否则重启会丢运行时新增数据。

## 17. 已购/可用题包导出PDF

业务规则：

- 只有免费题包、已购买题包、已入库题包可以导出。
- 未购买的积分题包只能预览，不能导出完整打印版。
- 导出不再二次收费，购买题包后永久可用。

实现入口：

- `GET /api/question-packs/:id/export?user=...`：生成题包打印页面，浏览器打印时可保存为 PDF。
- 学生端“题库商城”已入库/免费题包卡片增加“导出PDF”。
- 学生端“练习中心 / 我的题库”题包卡片和预览弹窗增加“导出PDF打印版”。

导出内容：

- 题包标题、学生、生成时间、年级学科、题量、预计用时、题包类型。
- 训练结构、知识点覆盖、题型分布。
- 完整题目、选项、答题留白。
- 单独分页的答案与解析，方便家长打印后核对。

验证记录：2026-04-28 10:10 CST

- `node --check backend/src/server.js` 通过。
- `node --check backend/src/seed-data.js && npm run check:api` 通过。
- `npm run build` 通过。
- 临时 API 验证：免费题包导出返回 `200 text/html`，页面包含“题目打印版”和 `window.print`。
- 临时 API 验证：未购买积分题包导出返回 `403`。
- 临时 API 验证：购买积分题包后导出返回 `200`，页面包含“答案与解析”。

## 18. 错题导出打印

业务判断：

- 家长最常打印的是待处理错题、某个薄弱知识点专项、孩子临时勾选的一组错题。
- 错题导出应直接生成 PDF，不需要再进入预览页。
- 导出不扣积分，属于错题回收和家庭辅导能力。

实现入口：

- `GET /api/wrong-questions/export.pdf?ids=...&title=...`：按错题 ID 导出 PDF。
- 错题页右上角：导出当前筛选结果。
- 错题页“高频专项”：导出该知识点专项错题。
- 错题页选中题目后：导出所选错题。
- 错题页 / 练习中心最近错题小卷：支持导出已生成的小卷。
- 练习中心“错题回收”知识点卡片：支持导出专项错题。

验证记录：2026-04-28 11:10 CST

- `npm run build` 通过。
- `GET /api/wrong-questions/export.pdf?ids=wq-1,wq-2&title=错题打印测试` 返回 `200 application/pdf`。
- PDF 文件头为 `%PDF`。

## 注意事项

- 仓库当前没有 `.git`，不能依赖 git diff 追踪改动。
- 不要使用 OMX，按 Codex 原生工具工作。
- 本项目当前真实目录是 `/Users/forkman03/Share/tixiaozhu/tixiaozhu`。
- 若端口页面不更新，优先重启后端，再刷新 Vite 页面。
- 题库生成器在 `backend/src/elementary-question-bank.js`，要调整题库体系优先改这里。
- 前台/后台学科枚举也要同步，避免后端生成了但页面筛不到。

## 19. 题库专业结构持续升级

2026-05-03 持续推进结果：

- 已新增知识点覆盖分析接口：`GET /api/question-bank-coverage`
- 已补齐所有知识点的三层链路覆盖：教材同步 / 专项训练 / 试卷诊断
- 当前覆盖验证结果：
  - `knowledgePoints: 108`
  - `averageCoverageScore: 100`
  - `leadingCount: 108`
  - `missingSeriesPoints: 0`

补充说明：

- 这次没有把“专项训练”做成全知识点混装
- 当前专项包已具备明确主题焦点，例如 `四年级数学计算能力专项` 聚焦 `三位数乘两位数 / 运算律 / 小数初步认识`
- 现在实现的是“全库覆盖完整”和“单包主题明确”同时成立

## 20. 难度梯度与讲评资产

同日继续推进结果：

- 单题新增：`difficultyTier`、`masteryStage`、`variantType`
- 知识点新增：`teachingFocus`、`parentCoach`、`commonMistakes`、`recoveryAction`、`explanationScript`、`remediationChecklist`
- 后台“习题内容中心”和“题库与知识点中心”已可直接查看：
  - 难度梯度
  - 掌握阶段
  - 高频错因专题
  - 讲评与家长辅导脚本

当前验证结果：

- 全库 `difficultyTiers` 已形成：
  - `基础巩固`
  - `方法进阶`
  - `迁移提升`
  - `压轴突破`
- 全库 `masteryStages` 已形成：
  - `入门识别`
  - `基础掌握`
  - `方法迁移`
  - `综合突破`
  - `诊断回收`
  - `压轴突破`
- 抽样验证 `四年级数学上册第1单元同步练` 已具备完整梯度和变式链

这意味着题库已经从“题目库”进一步进化为：

- 训练资产库
- 覆盖分析库
- 讲评资产库

## 21. 知识点补弱讲义导出

继续把“讲评资产库”往可交付方向推进，本轮新增：

- `GET /api/knowledge-points/:id/coach-pack.pdf`
- 后台“题库与知识点中心”每个知识点支持“导出讲义”

讲义内容包含：

- 知识点定位与覆盖情况
- 讲评重点
- 家长辅导建议
- 高频错因
- 补弱清单
- 代表题示例与答案解析

验证结果：

- `GET /api/knowledge-points/kp-primary-g1-math-1/coach-pack.pdf` 返回 `200 application/pdf`
- 下载内容文件头为 `%PDF`

这意味着当前题库已经不只是能训练和管理，还能开始直接产出“老师讲评稿 / 家长辅导讲义”。

## 22. 命题人级内容资产升级

继续围绕“专业、高标准、丰富、行业领先”的题库目标，本轮把单题从“有专业字段”推进到“有命题人编审资产”：

- 单题新增：`expertTeacherLens`、`teachingIntent`、`stemDesign`、`solutionSteps`、`keyCheckpoint`、`misconceptionDiagnosis`、`variantIntent`、`classroomReviewScript`、`parentReviewScript`、`gradingPoints`、`extensionPrompt`、`contentQualityLevel`
- 单题解析已从一句说明升级为：原解析 + 解题步骤 + 错因提醒 + 讲评建议
- 题库质检新增“名师命题资产不足”检查，要求题目必须具备步骤解析、错因诊断、变式意图、评分要点和讲评脚本
- 后台“习题内容中心”已展示内容层级、命题意图、题干设计、步骤、错因诊断和变式价值
- 题包打印和知识点讲义导出已包含更完整的评分要点、变式价值和追问变式
- 本地持久化加载新增 seed 题库升级合并逻辑，避免旧 `backend/data/store.json` 覆盖掉新教研字段

验证结果：

- `npm --prefix backend run audit:question-bank` 通过
- 当前仍为 `252` 个题包、`6912` 道题、`108` 个知识点
- `duplicateContentGroups: 0`
- `weakExpertDesign: 0`
- 内容层级分布：`名师精讲题 1476`、`高标准原创题 3636`、`校内检测风格 1800`
- `npm --prefix backend run audit:product-readiness` 返回 `ready`、`issueCount: 0`
- `npm run build` 通过，后台仍有较大 bundle 警告，不阻塞当前题库目标
- 真实后端接口 `GET /api/question-bank-quality` 返回 `readiness: ready`、`contentQualityLevelCount: 3`、`issues: []`
- 抽样 `primary-g4-math-u1-q01` 已返回命题意图、4 步解题步骤、错因诊断、变式价值和 4 条评分要点

## 23. 题目正文内容升级

用户明确要求：题库不能只是字段专业，必须以优秀老师和资深出题人的标准去“出题”，也就是题目内容本身要更专业、更丰富。

本轮继续向题干源头推进：

- 所有单题正文统一升级为“情境/材料 + 单元语境 + 核心任务 + 作答要求”的结构
- 数学题从短口算/裸计算进一步改成真实问题情境，例如图书角、书法社团、劳动实践、科技节材料等
- 语文题强化阅读材料、依据定位、完整表达和场景化造句，不再只停留在词句填空
- 英语题强化短语境、人物任务、地点线索、书面表达关联性，而不是孤立词汇/语法判断
- 新增 `originalStem`，保留真正的核心题干，便于后续人工编辑、去重和二次打磨
- 题库审计新增 `thinQuestionBody` 检查：短题干、薄解析、没有“任务：”结构的题不再通过
- 后台题包预览改为多行展示题干正文，方便运营和教研直接检查题目内容质量

验证结果：

- `npm --prefix backend run audit:question-bank` 通过
- `thinQuestionBody: 0`
- `duplicateContentGroups: 0`
- `weakExpertDesign: 0`
- `npm --prefix backend run audit:product-readiness` 返回 `ready`
- `npm run build` 通过
- 真实后端接口 `GET /api/questions?packId=primary-g4-math-u1` 已返回新版情境化题干和 `originalStem`

## 24. 成组变式与去机械题干

继续执行“专业、高标准、丰富、行业领先题库”的长期目标，本轮重点不是新增字段，而是进一步修改题目内容和题组编排：

- 所有题目新增题组角色，进入六类变式链路：
  - `A组·概念识别`
  - `B组·基础稳定`
  - `C组·方法迁移`
  - `D组·综合应用`
  - `E组·易错回收`
  - `F组·压轴挑战`
- 题干正文会直接显示题组角色，例如基础题看条件识别、方法题看步骤解释、迁移题看条件筛选、压轴题看关系变化判断
- 数学核心题干继续去机械化：
  - 小数题从 `计算：15.7 + 11.8` 改为科学测量记录情境
  - 方程题改为图书登记等量关系情境
  - 百分数题改为阅读任务完成率情境
  - 比例、面积、分数、平均数题均补充真实任务语境
- 语文题继续强化材料任务、通知定位、古诗文关键词和习作三句结构
- 英语题继续强化 diary note、plan、poster、lunch note 等短语境，而不是孤立语法题
- 题库审计新增 `mechanicalOriginalStem` 检查，防止裸计算、裸方程和泛化练习题残留
- 后台题库质检新增题组角色统计，题目预览可直接查看题组与任务定位

验证结果：

- `npm --prefix backend run audit:question-bank` 通过
- `mechanicalOriginalStem: 0`
- `thinQuestionBody: 0`
- `duplicateContentGroups: 0`
- `weakExpertDesign: 0`
- 六类题组分布：
  - `A组·概念识别 1296`
  - `B组·基础稳定 2160`
  - `C组·方法迁移 1800`
  - `D组·综合应用 1080`
  - `E组·易错回收 432`
  - `F组·压轴挑战 144`
- `npm --prefix backend run audit:product-readiness` 返回 `ready`
- `npm run build` 通过，后台仍仅有大 bundle 警告
- 真实接口 `GET /api/question-bank-quality` 返回 `readiness: ready`、`issues: []`、`variantFamilyCount: 6`
- 真实接口抽样 `primary-g4-math-special-1-q18` 已从裸小数计算变成科学测量记录情境，并属于 `C组·方法迁移`

## 25. 商业上线计划与上线审计闸门

2026-05-08 按“商业上线”角度开始推进，本轮先完成计划和第一批 P0 修复：

- 新增商业上线计划文档：`docs/commercial-launch-plan.md`
- 新增商业上线审计模块：`backend/src/commercial-launch-readiness.js`
- 新增命令：`npm --prefix backend run audit:commercial-launch`
- 新增接口：`GET /api/commercial-launch-readiness`
- 后台“系统与权限中心”新增“商业上线审计”卡片，直接显示上线阻塞项
- 后台登录支持生产环境变量覆盖：
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
- 后台登录新增基础失败次数限制，连续错误后返回 `429`
- CORS 头补齐 `Authorization`、`X-Admin-Token`，并支持 `CORS_ALLOW_ORIGIN`

当前商业上线审计结果：

- `readiness: blocked`
- `issueCount: 10`
- 高危阻塞包括：
  - 本地文件数据层
  - 默认管理员配置
  - 默认管理员会话密钥
  - 学生端真实账号体系未接入
  - 支付仍处于测试模式
  - 真实支付商户配置缺失
- 中危阻塞包括：
  - AI/OCR 测试服务口径
  - 文件与导出物未接入对象存储
  - 缺少生产监控与告警
  - 前后台正式域名未显式配置

验证结果：

- `npm --prefix backend run audit:commercial-launch` 正确返回失败退出码，表示当前不能商业上线
- `npm --prefix backend run audit:question-bank` 仍通过
- `npm --prefix backend run audit:product-readiness` 仍返回 `ready`
- `npm run build` 仍通过，后台仅保留 bundle 偏大警告
- 使用环境变量启动后：
  - 旧 `admin/admin123` 登录返回 `401`
  - 新环境变量账号可登录
  - 连续错误登录后返回 `429`
  - `OPTIONS` 预检返回 `Access-Control-Allow-Headers: Content-Type,Authorization,X-Admin-Token`

阶段判断：

- 内测基线：可用
- 商业上线：阻塞
- 下一步优先级：生产数据库、真实学生账号、正式支付回调验签

## 26. 学生账号与支付回调 P0 闭环

2026-05-08 继续按商业上线 P0 推进，补齐两条核心链路：

- 新增学生账号接口：`POST /api/auth/register`
- 新增学生登录接口：`POST /api/auth/login`
- 新增学生会话接口：`GET /api/auth/session`
- 学生 token 使用 `STUDENT_SESSION_SECRET` 签名，生产环境必须显式配置
- 学生端“我的”页新增账号状态卡片、登录/注册弹窗和退出登录能力
- 学生端启动时会用本地 token 调用 `/api/auth/session` 恢复正式账号档案
- 前端 API 会自动携带学生 Bearer token
- 生产运行或 `REQUIRE_STUDENT_AUTH=true` 时，练习记录、收藏题、拍题沉淀、内容购买、积分购买和支付会话会强制绑定真实学生账号
- 生产运行下个人学习记录、错题、收藏、上传题、内容购买、积分账户和题包导出会按登录学生或管理员权限读取，不再信任任意 query 昵称
- 学生注册会创建独立学生档案，同昵称不同账号不再复用同一 `userId`
- 学生登录新增失败次数限制，错题状态更新、收藏去重、内容购买归属和积分账户均优先按 `userId` 隔离，降低同昵称学生数据串档风险
- 题目明细接口新增题包访问权校验，未解锁积分题包不能绕过前端直接读取题目；学生端题包导出和错题导出改为携带登录态请求
- 学生端和后台端生产构建默认请求同源 `/api`，不再默认连浏览器本机 `127.0.0.1:8787`；生产默认禁用 API 失败后的 mock fallback
- 后台收费页收入、付费用户、待支付、退款和续费提醒改为从真实订单数据计算，不再展示硬编码收入/续费演示数字
- 学生端首页推荐改为读取真实题包接口，正式包不再依赖本地 SAMPLE 题包作为今日建议或继续练习兜底
- 后台运营数据接口继续收紧：知识点、学科成绩、题包版本、知识点讲义和积分规则接口需要管理员 token，避免生产环境暴露后台运营面板数据
- 知识点讲义导出已改为后台带授权请求，不再依赖裸 PDF 链接
- 支付延期生产模式下，未登录后台的公开 `membership-plans` / `point-packages` 返回空列表，避免在支付未上线时暴露可购买套餐
- 生产 smoke 脚本已同步覆盖这些要求：支付延期公开套餐为空、学生数据需登录、后台运营/审计接口匿名访问被拒绝；如提供 smoke 管理员账号，还会验证后台接口管理员可用
- 新增生产构建产物审计：`npm run audit:production-build` 会先构建学生端和后台端，再扫描 `dist`，防止本地 API、测试支付、默认账号、旧演示订单/题包/收入文案和 source map 混入生产包
- 学生端模拟支付确认 `/payments/mock-confirm` 已限制为开发环境自动确认，生产构建不会再包含该路径
- 新增运行时安全审计：`npm run audit:runtime-security` 会自动启动隔离生产模拟后端，注册两个学生，并验证匿名学生数据被拒绝、学生数据按账号隔离、未购买积分题包无法读题、支付延期入口关闭、后台运营接口需要管理员 token
- 新增支付平台回调接口：`POST /api/payments/webhook`
- 支付回调使用 `PAYMENT_WEBHOOK_SECRET` 与 `X-Payment-Signature` 做 HMAC 验签
- 新增 `paymentWebhookEvents` 事件记录，支付平台重复通知会返回 duplicate，不重复发放会员或积分
- 会员订单与积分订单都可通过同一支付确认状态机处理
- 商业上线审计新增支付回调密钥检查，并把 `STUDENT_SESSION_SECRET` 纳入真实学生账号能力判断
- 订单列表、支付流水、用户列表、积分流水、退款和商业上线审计接口收口到管理员 token
- 直接创建已支付订单只允许测试支付模式；生产支付模式必须走支付会话与支付回调，避免绕过真实支付
- 系统设置、AI 出题和 AI 生成历史接口收口到管理员 token
- 生产环境缺少 `AI_API_KEY` / `AI_API_BASE` / `AI_MODEL` 时，AI 出题会返回服务未配置；`OCR_LAUNCH_STRATEGY=deferred` 时拍题识别明确延期并隐藏入口，不再用 mock 结果伪装正式能力
- 新增 `.env.production.example`，把数据库、管理员、学生会话、支付延期、OCR 延期、AI、对象存储、监控和正式域名配置固化为上线环境样板
- 新增 PostgreSQL 数据层：`TIXIAOZHU_DATA_LAYER=postgres` + `DATABASE_URL` 时，业务主数据会保存到 PostgreSQL JSONB 快照表
- 新增生产启动闸门：`TIXIAOZHU_ENV=production` 且商业审计未达到 `launch_ready` 时拒绝启动，隔离验证才允许 `ALLOW_BLOCKED_PRODUCTION_START=true`
- 新增数据迁移脚本：`store:export` 可导出当前快照，`store:import` 可把快照写入当前数据层，用于本地 JSON 到 PostgreSQL 的上线迁移

阶段判断：

- 学生账号后端闭环：已建立
- 学生端账号入口：已建立
- 支付回调验签与幂等：已建立
- 支付旁路与敏感运营接口：已加固
- 商业上线：支付和拍照识别按延期项处理后，主要看生产数据库、AI、对象存储、监控、正式域名和线上 smoke gate
