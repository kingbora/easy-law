import path from 'node:path';

import dotenv from 'dotenv';

const envFile = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envFile });

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: parseNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/easy_law',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000'
};

export default env;
