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
    console.warn('Dropping schema "public" (cascade)...');
    await sql`drop schema if exists public cascade`;

    console.warn('Recreating schema "public"...');
    await sql`create schema public`;
    await sql`grant all on schema public to public`;
    await sql`grant all on schema public to current_user`;

    console.warn('Dropping schema "drizzle" (cascade)...');
    await sql`drop schema if exists drizzle cascade`;

    console.warn('Recreating schema "drizzle"...');
    await sql`create schema drizzle`;

    // eslint-disable-next-line no-console
    console.log('Database schemas reset. You can rerun migrations now.');
  } catch (error) {
    console.error('Failed to reset database schemas', error);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

void main();