import 'dotenv/config';
import postgres from 'postgres';

const PRESERVED_TABLES = new Set(['user', 'account', 'session', 'verifications']);

const quoteIdentifier = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1, ssl: false });

  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
    `;

    const targetTables = tables
      .map(row => row.tablename)
      .filter(name => !PRESERVED_TABLES.has(name));

    if (!targetTables.length) {
      console.warn('No tables found to truncate. User table data preserved by default.');
      return;
    }

    console.warn('Truncating public tables (excluding user table data)...');
    for (const tableName of targetTables) {
      const qualifiedName = `${quoteIdentifier('public')}.${quoteIdentifier(tableName)}`;
      console.warn(` -> Truncating ${qualifiedName}`);
      await sql.unsafe(`TRUNCATE TABLE ${qualifiedName} RESTART IDENTITY CASCADE`);
    }

    // eslint-disable-next-line no-console
    console.log('All non-user tables have been truncated. User data preserved.');
  } catch (error) {
    console.error('Failed to truncate tables', error);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

void main();