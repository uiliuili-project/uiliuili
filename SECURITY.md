# Security Policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report vulnerabilities privately via GitHub Security Advisories on the uiliuili
repository, or by contacting the maintainers listed in the repository profile.
Include:

- affected version and component;
- reproduction steps;
- impact assessment;
- any suggested fix.

We aim to acknowledge reports within 72 hours and provide a remediation plan
within 7 days.

## Deployment hardening

- Complete the installer immediately after exposing a new instance. The
  installer requires a one-time token, but an uninstalled instance should never
  be left publicly accessible.
- Serve production instances over HTTPS.
- Use a dedicated PostgreSQL user and database.
- Keep `.env`, `config/instance.json`, and backups private.
- Rotate SMTP, S3, and OAuth credentials if they may have leaked.
- Keep Node.js, PostgreSQL, FFmpeg, and dependencies up to date.
