# 邮件与 OAuth

> [English](../oauth.md)

两者都是可选项。本地用户名/邮箱 + 密码登录始终可用。

## SMTP

在安装器或管理后台设置中配置主机、端口、TLS 模式、用户名、密码和发件人。启用邮件后可以使用：

- 邮箱验证（可选）；
- 找回密码；
- 通知邮件。

如果关闭邮件，邮箱验证会自动禁用。管理员可以在管理后台或通过 CLI 重置密码。

## OAuth

支持的提供方：

- GitHub
- Google
- 通用 OIDC（Keycloak、Authentik、Authelia 等）

回调地址：

```text
{siteUrl}/api/v1/auth/oauth/github/callback
{siteUrl}/api/v1/auth/oauth/google/callback
{siteUrl}/api/v1/auth/oauth/oidc/callback
```

每个提供方可以独立启用。禁用的提供方不会出现在登录页。

## 账号绑定

只有当 OAuth 提供方返回**已验证**的邮箱，且该邮箱与现有本地账号匹配时，才会自动绑定。否则用户必须先使用本地账号登录，再到账号设置中手动绑定。这样可以防止通过未验证的第三方邮箱接管账号。

仅有 OAuth 登录方式的账号在通过邮件或管理员设置密码之前，没有本地密码。
