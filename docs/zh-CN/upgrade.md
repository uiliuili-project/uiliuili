# 升级、备份与恢复

> [English](../upgrade.md)

## 升级

通用原则：**先备份，再升级**。数据库、`.env`、`config/instance.json` 和本地上传文件必须一起备份；缺少 `.env` 就无法解密数据库中的第三方密钥。

### 原生部署

```bash
# 1. 备份
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
tar -czf config-$(date +%F).tgz .env config/instance.json
tar -czf uploads-$(date +%F).tgz storage/uploads

# 2. 更新代码并构建
git pull
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 3. 应用数据库迁移
pnpm cli migrate

# 4. 重启服务
sudo systemctl restart uiliuili-api uiliuili-worker uiliuili-web
```

管理后台是 Nginx 直接提供的静态文件（`apps/admin/dist`）。`pnpm build` 会重新生成
它，因此重启或刷新浏览器后即为新版本；只重启 API 不会更新后台页面。

如果存在待执行迁移，`pnpm cli migrate` 会全部应用。也可以登录管理后台，在
**系统状态 → 升级中心**创建备份并执行数据库升级。

### Docker 部署

```bash
# 1. 备份数据库与 app-data 卷（见下文命令）
# 2. 更新并重建
git pull
docker compose build
docker compose up -d
docker compose logs -f bootstrap
```

代码与依赖都在镜像里，持久数据只在 `/data` 与数据库。`bootstrap` 会在 API 启动前
应用迁移；它失败时 API 与 worker 不会启动，先看 `docker compose logs bootstrap`。

### 降级

代码回退后，用升级前创建的数据库备份恢复：

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump
```

Docker 还需恢复 `app-data` 卷。降级可能丢失升级后产生的数据，请确认后再执行。

### 升级中心

**管理后台 → 系统状态**中的升级中心只处理数据库迁移与备份，不会自动替换程序代码。它显示数据库版本、当前程序版本、待执行迁移以及最近 5 份备份。

- **创建备份**执行 `pg_dump --format=custom`，写入 `storage/backups`，同时复制 `.env` 与 `config/instance.json`。Docker 镜像已安装 `postgresql-client`；原生部署需要 `pg_dump` 在 `PATH` 中。
- **执行数据库升级**要求输入当前程序版本号二次确认；随后自动备份、短暂开启维护模式、在迁移 advisory lock 下执行全部待处理迁移、更新 `app_instance.version` 并写入审计日志。
- 浏览器不能执行任意 shell。只有在 API 环境变量中设置固定的 `UPGRADE_RESTART_CMD`（例如 `systemctl restart uiliuili-api uiliuili-worker`）时，升级成功后才会执行该命令；未配置时页面会提示管理员手动重启 API 与 Worker。
- **维护模式**可独立开关，便于在手动替换代码前阻止写入。维护期间访客看到维护页，员工仍可登录。

迁移 `0006` 新增协议同意记录、AI 审核日志、评论/动态审核元数据、分区展示字段，并且只在站点名仍为旧默认值 `uiliuili` 时改为「萌悠」，不会覆盖管理员自定义的站点名。

## 地区与限制级内容迁移

迁移 `0004` 新增 `users.region`、`users.region_source`、
`users.show_restricted` 以及视频的地区字段。已有账号的地区为空，下一次请求会按配置的请求头、GeoIP 数据库或默认地区解析。管理员可以在**用户管理**中更正单个账号。已有视频保持普通内容；可在创作中心或管理后台的视频编辑中标记为限制级，或添加单个视频的屏蔽国家列表。

## 恢复站长

迁移 `0003` 会把原来的 `SUPER_ADMIN` 账号映射到 `OWNER` 用户组，并补齐其他用户组。如果存在多个 `SUPER_ADMIN` 账号，只有最早创建的保留站长身份，其余降为管理员。

如果没有任何站长能登录，在服务器上执行：

```bash
# 原生
pnpm cli owner:promote --username owner --email owner@example.com

# Docker
docker compose run --rm bootstrap node dist/index.js owner:promote \
  --username owner --email owner@example.com
```

`admin:create` 是别名。命令会在事务中替换当前站长；不提供密码时会生成随机密码并打印。登录后请在**管理后台 → 用户 → 设为站长**中转移身份，不要直接改数据库。

## 备份

原生部署需要备份：

- PostgreSQL 数据库；
- `.env`（包含 `APP_KEY` 与数据库凭据）；
- `config/instance.json`；
- 本地存储目录（`storage/uploads`）；
- 使用 S3 时的桶内容。

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
tar -czf uiliuili-config.tgz .env config/instance.json
tar -czf uiliuili-uploads.tgz storage/uploads
```

仓库提供的 `infra/scripts/backup.sh` 会自动加载 `.env`、导出数据库并打包配置与上传
目录，可用 cron 定时执行：

```bash
sudo install -m 755 infra/scripts/backup.sh /usr/local/bin/uiliuili-backup
sudo /usr/local/bin/uiliuili-backup
```

Docker 部署的备份与恢复命令见 [Docker 部署 · 备份与恢复](docker.md#备份与恢复)。

## 恢复

1. 停止 API 与 worker；
2. 用 `pg_restore` 恢复数据库；
3. 恢复 `.env`、`config/instance.json` 与上传文件；
4. 启动服务；
5. 打开管理后台系统状态检查，并播放一个样例视频。

请定期演练恢复。没有 `APP_KEY`，已保存的 S3、SMTP、OAuth、验证码与 AI 审核密钥
无法恢复。
