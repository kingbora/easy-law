import 'dotenv/config';
import app from './app';
import { sql } from './db/client';

const bootstrap = async () => {
  app.listen(process.env.PORT || '4000', () => {
    console.warn(`🚀 Server ready at http://localhost:${process.env.PORT}`);
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
