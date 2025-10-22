import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set in environment variables');
}

export const sql = postgres(process.env.DATABASE_URL, {
	max: 10,
	ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined
});

export const db = drizzle(sql, { schema });

export type Database = typeof db;
