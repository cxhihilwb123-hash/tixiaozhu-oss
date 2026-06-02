# PostgreSQL 接入与迁移

当前后端已经支持 `file` 和 `postgres` 两种数据层。正式商业上线必须使用 PostgreSQL 或等价生产数据库；本地 JSON 只适合开发和演示。

## 本地验证

启动本地 PostgreSQL：

```bash
npm run db:local:start
```

导出当前文件数据快照：

```bash
npm run db:export:file
```

导入本地 PostgreSQL：

```bash
npm run db:import:local-postgres
```

从 PostgreSQL 再导出一份验证快照：

```bash
npm run db:verify:local-postgres
npm --prefix backend run store:validate -- backend/data/postgres-verify-export.json
```

如果需要清空本地数据库重新来一遍：

```bash
npm run db:local:reset
npm run db:local:start
```

## 生产环境变量

生产至少需要：

```bash
TIXIAOZHU_DATA_LAYER=postgres
DATABASE_URL=postgres://user:password@host:5432/tixiaozhu
TIXIAOZHU_DATABASE_TABLE=tixiaozhu_store
```

如果云数据库要求 SSL：

```bash
DATABASE_SSL=true
```

后端启动时会自动创建快照表：

```sql
CREATE TABLE IF NOT EXISTS tixiaozhu_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 上线前检查

接入真实数据库后必须执行：

```bash
npm --prefix backend run store:export -- backend/data/prelaunch-store-backup.json
npm --prefix backend run store:validate -- backend/data/prelaunch-store-backup.json
TIXIAOZHU_DATA_LAYER=postgres DATABASE_URL=postgres://... \
  npm --prefix backend run store:import -- backend/data/prelaunch-store-backup.json
TIXIAOZHU_ENV=production TIXIAOZHU_DATA_LAYER=postgres DATABASE_URL=postgres://... \
  npm --prefix backend run preflight:production
```

`preflight:production` 会真实连接 PostgreSQL，并拒绝 `replace-with-*`、`example.com`、`placeholder` 等占位配置。
