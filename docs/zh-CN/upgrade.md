# 升级、备份与恢复

> [English](../upgrade.md)

## 升级

1. 备份数据库、`.env`、`config/instance.json` 和本地上传文件。
2. 用新版本代码替换应用目录。
3. 运行 `pnpm install && pnpm build`。
4. 运行 `pnpm cli migrate`。
5. 重启 API、worker、web 和管理后台。

如果存在待执行的迁移，运行 `pnpm cli migrate`。如果要降级代码，请恢复升级前创建的数据库备份。

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
