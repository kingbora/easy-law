import { migrate } from 'drizzle-orm/postgres-js/migrator';

import env from '../config/env';
import { db } from '../db/client';
import { ensureSeedUser } from '../db/seeds/default-user';

export const runMigrationsAndSeeds = async () => {
  if (env.nodeEnv === 'test') {
    return;
  }

  await migrate(db, { migrationsFolder: './drizzle' });
  await ensureSeedUser();
};
