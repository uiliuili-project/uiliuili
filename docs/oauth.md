# Mail and OAuth

> [简体中文](zh-CN/oauth.md)

Both are optional. Local username/email + password login always works.

## SMTP

Configure host, port, TLS mode, username, password, and sender in the installer
or admin settings. Enabling mail allows:

- email verification (optional);
- password reset;
- notification emails.

If mail is disabled, email verification is automatically disabled. Administrators
can reset passwords from the admin panel or CLI.

## OAuth

Supported providers:

- GitHub
- Google
- Generic OIDC (Keycloak, Authentik, Authelia, etc.)

Callback URLs:

```text
{siteUrl}/api/v1/auth/oauth/github/callback
{siteUrl}/api/v1/auth/oauth/google/callback
{siteUrl}/api/v1/auth/oauth/oidc/callback
```

Each provider can be enabled independently. Disabled providers are hidden from
the login page.

## Account linking

An OAuth login only links automatically when the provider returns a verified
email that matches an existing local account. Otherwise the user must log in
locally first and link the provider from account settings. This prevents account
takeover through unverified provider emails.

OAuth-only accounts have no local password until they set one through email or
an administrator.
