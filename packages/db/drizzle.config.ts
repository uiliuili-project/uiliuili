import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://uiliuili:uiliuili@127.0.0.1:5432/uiliuili',
  },
  schemaFilter: ['uiliuili'],
  strict: true,
  verbose: true,
});
