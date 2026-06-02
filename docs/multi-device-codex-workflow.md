# 多电脑 Codex 开发协作说明

本文档用于说明如何在不同电脑上使用 Codex 开发同一个 `tixiaozhu` 项目，并保持代码、配置和开发进度一致。

## 核心原则

`GitHub` 是唯一代码中心，每台电脑都是独立开发环境。

- 代码统一从主仓库拉取：`https://github.com/cxhihilwb123-hash/tixiaozhu`
- 每台电脑都需要单独安装依赖、配置环境变量和本地数据库。
- 开发前先拉取最新代码，开发完成后及时提交并推送。
- 不要把真实密钥、真实数据库数据、测试产物提交到 GitHub。
- 如果多台电脑同时开发，尽量按模块分工，减少改同一个文件造成冲突。

## 新电脑初始化

### 1. 克隆项目

```bash
git clone https://github.com/cxhihilwb123-hash/tixiaozhu.git
cd tixiaozhu
```

### 2. 安装依赖

项目包含根目录、后端、学生端和后台端依赖，建议全部安装。

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix admin install
```

### 3. 配置环境变量

真实环境变量不会提交到 GitHub。新电脑需要根据示例文件创建本地配置。

```bash
cp .env.deepseek.local.example .env.deepseek.local
cp .env.postgres.local.example .env.postgres.local
cp .env.production.example .env.production.local
```

然后根据当前电脑实际情况填写：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `DATABASE_URL`
- 生产环境密钥、管理员账号、JWT 密钥等

注意：`.env.deepseek.local`、`.env.postgres.local`、`.env.production.local` 属于本地私密配置，不要提交。

### 4. 准备 PostgreSQL

如果这台电脑需要跑真实数据库，可以使用项目内的 PostgreSQL compose 文件。

```bash
docker compose -f docker-compose.postgres.yml up -d
```

启动后执行验证：

```bash
npm run db:verify:local-postgres
```

如果只做前端样式、文档或轻量开发，可以先不启动 PostgreSQL，但不能把这种状态当作上线验收通过。

## 日常开发流程

每次开始开发前，先确认当前分支和远程同步状态。

```bash
git status
git pull
```

完成修改后，先检查变更范围。

```bash
git status
git diff
```

提交并推送：

```bash
git add .
git commit -m "简短说明本次修改"
git push
```

如果另一台电脑已经推送了新代码，本机提交前必须先 `git pull`，避免本地代码落后。

## 推荐分工方式

多电脑开发时，最稳的方式是按职责拆分。

- 电脑 A：学生端页面、三端适配、交互体验。
- 电脑 B：后台管理、题库管理、运营功能。
- 电脑 C：后端接口、数据库、AI/OCR、上线脚本。
- Codex 会话之间：每次开始前先让 Codex 检查 `git status`、最近提交和当前任务文档。

不要让两台电脑同时大改同一个文件，例如同时修改 `backend/src/server.js` 或同一个前端页面，这样最容易产生合并冲突。

## 冲突处理

如果 `git pull` 时出现冲突，先不要慌，也不要直接丢弃代码。

查看冲突文件：

```bash
git status
```

打开冲突文件后，会看到类似内容：

```text
<<<<<<< HEAD
本机修改
=======
远程修改
>>>>>>> origin/main
```

处理原则：

- 保留真正需要的业务逻辑，而不是机械选择某一边。
- 冲突解决后运行相关测试。
- 确认无误后再提交合并结果。

解决后：

```bash
git add .
git commit -m "Resolve merge conflicts"
git push
```

如果冲突涉及题库、订单、数据库迁移、鉴权、支付等关键逻辑，必须先人工复核业务含义，再让 Codex 继续修。

## Codex 使用建议

在每台电脑的新 Codex 会话开始时，可以让 Codex 先执行：

```bash
git status --short --branch
git log --oneline -5
```

然后告诉 Codex 当前目标，例如：

```text
继续按照商业上线标准修复 tixiaozhu。先检查当前状态，再继续开发和验证。
```

如果需要让 Codex 提交 GitHub，可以明确说：

```text
检查变更，整理提交，并推送到 GitHub。
```

Codex 在提交前应检查：

- 是否误提交了 `.env.*`、真实密钥、测试数据、`node_modules`。
- 是否存在无关文件或临时产物。
- 是否已经运行和本次修改相关的验证命令。
- 是否清楚本次提交解决了什么问题。

## 上线前协作纪律

正式商业上线前，多电脑协作要更保守。

- 每个功能完成后都要有对应验证记录。
- 题库修改后必须跑题库质量审计。
- 后端、数据库、AI 配置修改后必须跑生产就绪检查。
- 学生端页面修改后必须跑移动端、平板、桌面适配检查。
- 不要在未同步远程代码的情况下继续大范围开发。
- 不要把本地临时验证结果当成生产环境已通过。

推荐上线前固定执行：

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm run audit:runtime-security
npm run audit:launch-ui
```

如果启用了真实 PostgreSQL 和 AI 配置，再执行：

```bash
npm run db:verify:local-postgres
npm run verify:ai
```

## 常见问题

### 一台电脑改完，另一台电脑看不到怎么办？

先确认第一台电脑已经执行：

```bash
git push
```

然后第二台电脑执行：

```bash
git pull
```

### 可以同时开多个 Codex 做同一个项目吗？

可以，但要分工明确。不要让多个 Codex 同时改同一批文件。一个 Codex 负责学生端，另一个负责后台或后端，会更安全。

### 真实 DeepSeek Key 和数据库密码怎么同步？

不要通过 GitHub 同步。建议使用密码管理器、加密笔记或运维密钥系统。GitHub 只保存 `.env.*.example` 示例，不保存真实密钥。

### 换电脑后项目跑不起来，先查什么？

按顺序检查：

```bash
git status --short --branch
node -v
npm -v
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix admin install
```

然后检查 `.env.*` 是否存在、PostgreSQL 是否启动、AI Key 是否配置正确。

## 最佳实践总结

每台电脑开始开发前：

```bash
git pull
```

每次完成一个阶段：

```bash
git status
git add .
git commit -m "说明本次完成内容"
git push
```

每次让 Codex 接手前：

```text
先检查当前 Git 状态、项目进度文档和最近提交，再继续执行。
```

这样就能让不同电脑、不同 Codex 会话都围绕同一个 GitHub 主仓库协作，既能持续推进，也能最大程度避免代码丢失和进度混乱。
