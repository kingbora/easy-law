/* eslint-disable no-console */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const schemaExists = await sql<[{ exists: boolean }]>`select exists (
      select 1
      from information_schema.schemata
      where schema_name = 'drizzle'
    ) as exists`;

    if (!schemaExists[0]?.exists) {
      console.log('Schema \'drizzle\' does not exist. No migrations have been recorded.');
      return;
    }

    const tableExists = await sql<[{ exists: boolean }]>`select exists (
      select 1
      from information_schema.tables
      where table_schema = 'drizzle'
        and table_name = '__drizzle_migrations'
    ) as exists`;

    if (!tableExists[0]?.exists) {
      console.log('Table drizzle.__drizzle_migrations does not exist yet.');
      return;
    }

    const migrations = await sql<(object | undefined)[]>`select * from drizzle.__drizzle_migrations order by id`;

    if (migrations.length === 0) {
      console.log('No rows found in drizzle.__drizzle_migrations');
    } else {
      console.table(migrations);
    }
  } catch (error) {
    console.error('Failed to query migrations', error);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

void main();
