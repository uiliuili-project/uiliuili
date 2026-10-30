# 升级、备份与恢复

> [English](../upgrade.md)

## 升级

1. 备份数据库、`.env`、`config/instance.json` 和本地上传文件。
2. 用新版本代码替换应用目录。
3. 运行 `pnpm install && pnpm build`。
4. 运行 `pnpm cli migrate`。
5. 重启 API、worker、web 和管理后台。

如果存在待执行的迁移，运行 `pnpm cli migrate`。如果要降级代码，请恢复升级前创建的数据库备份。

### 升级中心

**管理后台 → 系统状态**新增升级中心。它只处理数据库迁移与备份，不会自动替换程序代码，并显示数据库版本、当前程序版本、待执行迁移以及最近 5 份备份。

- **创建备份**会执行 `pg_dump --format=custom`，把备份写入 `storage/backups`，同时复制 `.env` 和 `config/instance.json`。Docker 镜像已安装 `postgresql-client`；原生部署需要服务器 `PATH` 中存在 `pg_dump`。
- **执行数据库升级**要求输入当前程序版本号二次确认；随后自动备份、短暂开启维护模式、在迁移 advisory lock 下执行全部待处理迁移、更新 `app_instance.version` 并写入审计日志。
- 浏览器不能执行任意 shell。只有在 API 环境变量中设置固定的 `UPGRADE_RESTART_CMD`（例如 `systemctl restart uiliuili-api uiliuili-worker`）时，升级成功后才会执行该命令；未配置时页面会提示管理员手动重启 API 与 Worker。
- **维护模式**可独立开关，便于在手动替换代码前阻止写入。维护期间访客看到维护页，员工仍可登录。

迁移 `0006` 新增协议同意记录、AI 审核日志、评论/动态审核元数据、分区展示字段，并且只在站点名仍为旧默认值 `uiliuili` 时改为「萌悠」，不会覆盖管理员自定义的站点名。

## 地区与限制级内容迁移

迁移 `0004` 新增 `users.region`、`users.region_source`、
`users.show_restricted` 以及视频的地区字段。已有账号的地区为空，下一次请求会按配置的请求头、GeoIP 数据库或默认地区解析。管理员可以在**用户管理**中更正单个账号。已有视频保持普通内容；可在创作中心或管理后台的视频编辑中标记为限制级，或添加单个视频的屏蔽国家列表。

## 恢复站长

迁移 `0003` 会把原来的 `SUPER_ADMIN` 账号映射到 `OWNER` 用户组，并补齐其他用户组。如果存在多个 `SUPER_ADMIN` 账号，只有最早创建的保留站长身份，其余会降为管理员。

如果没有任何站长账号可以登录，可在服务器上恢复：

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` 是别名。该命令会在事务中替换当前站长。登录后请通过**管理后台 → 用户 → 设为站长**转移站长身份，不要直接修改数据库。

## 备份

需要备份：

- PostgreSQL 数据库；
- `.env`（包含 `APP_KEY` 和数据库凭据）；
- `config/instance.json`；
- 使用本地驱动时的本地存储目录；
- 使用 S3 时的 bucket 内容。

示例：

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
tar -czf uiliuili-config.tgz .env config/instance.json
tar -czf uiliuili-uploads.tgz storage/uploads
```

## 恢复

1. 停止 API 和 worker。
2. 使用 `pg_restore` 恢复数据库。
3. 恢复 `.env`、`config/instance.json` 和上传文件。
4. 启动服务。
5. 检查管理后台系统页面，并播放一个示例视频。

请定期演练恢复流程。丢失 `APP_KEY` 后，已加密的 S3、SMTP 和 OAuth 密钥将无法恢复。
