import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import env from '../config/env';

import * as schema from './schema';

export const sql = postgres(env.databaseUrl, {
	max: 10,
	ssl: env.nodeEnv === 'production' ? 'require' : undefined
});

export const db = drizzle(sql, { schema });

export type Database = typeof db;
