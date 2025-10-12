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
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  defaultUserEmail: process.env.DEFAULT_USER_EMAIL ?? 'test@qq.com',
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD ?? 'a@000123',
  defaultUserName: process.env.DEFAULT_USER_NAME ?? '测试用户'
};

export default env;
