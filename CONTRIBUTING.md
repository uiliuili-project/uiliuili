# Contributing to MoeYou (uiliuili)

Thank you for helping build MoeYou.

The repository, package scope, CLI command, environment prefixes, and database
schema keep the name `uiliuili`; only the product display name is MoeYou.

## Development setup

The full guide is in [docs/development.md](docs/development.md). In short:

1. Install Node.js 22+, PostgreSQL 16+, and FFmpeg 6+ (7 recommended).
2. Run `corepack enable && pnpm install`.
3. Copy `.env.example` to `.env` and set `APP_KEY` and `DATABASE_URL`.
4. Run `pnpm build` once so workspace packages and the CLI are available.
5. Use `pnpm dev` to run applications in watch mode.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before
   opening a PR.

Unit tests do not need external services. For end-to-end verification, run the
Docker stack (`./scripts/quickstart.sh` or `docker compose up -d`) and test the
installer, upload, transcoding, and playback paths there.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(api): add danmaku segment endpoint
fix(web): keep player time in sync after seeking
docs: document S3 CORS requirements
chore(deps): update postgres client
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

## Pull requests

- Keep changes focused.
- Include tests for behavior changes where practical.
- Update documentation and translations when user-facing text changes. Chinese
  and English catalogs must stay in sync.
- Add a migration when the schema changes, and keep it with the code that uses
  it.
- Do not commit secrets, `.env`, generated instance files, or uploads.

## Code style

Formatting and linting are handled by Biome. Run `pnpm lint:fix` before
committing.

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
