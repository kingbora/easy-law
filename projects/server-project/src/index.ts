import app from './app';
import env from './config/env';
import { sql } from './db/client';
import { runMigrationsAndSeeds } from './startup/migrate-and-seed';

const bootstrap = async () => {
  try {
    await sql`select 1`;
    await runMigrationsAndSeeds();
  } catch (error) {
    console.error('Startup checks failed', error);
    process.exit(1);
  }

  app.listen(env.port, env.host, () => {
    console.warn(`🚀 Server ready at http://${env.host}:${env.port}`);
  });
};

const shutdown = async () => {
  await sql.end({ timeout: 5 }).catch((error: unknown) => {
    console.error('Error closing database pool', error);
  });
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void bootstrap();
