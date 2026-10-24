import { describe, expect, it } from 'vitest';
import { splitStatements } from './migrate';

describe('migration statements', () => {
  it('splits Drizzle migration breakpoints and trims empty chunks', () => {
    const statements = splitStatements(
      'CREATE TABLE a (id int);--> statement-breakpoint\nCREATE TABLE b (id int);--> statement-breakpoint',
    );
    expect(statements).toEqual(['CREATE TABLE a (id int);', 'CREATE TABLE b (id int);']);
  });

  it('returns a single statement when no breakpoint exists', () => {
    expect(splitStatements('SELECT 1;')).toEqual(['SELECT 1;']);
  });
});
