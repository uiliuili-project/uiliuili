# Contributing to uiliuili

Thank you for helping build uiliuili.

## Development setup

1. Install Node.js 22+, PostgreSQL 16+, and FFmpeg 7+.
2. Run `corepack enable && pnpm install`.
3. Run `pnpm build` once so workspace packages are available.
4. Use `pnpm dev` to run applications in watch mode.
5. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a PR.

Integration tests require PostgreSQL, Redis (optional), and FFmpeg. They are
gated behind `RUN_INTEGRATION=1` and are not part of the default unit test run.

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
- Update documentation and translations when user-facing text changes.
- Do not commit secrets, `.env`, generated instance files, or uploads.

## Code style

Formatting and linting are handled by Biome. Run `pnpm lint:fix` before
committing.

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
