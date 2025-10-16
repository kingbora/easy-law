import { migrate } from 'drizzle-orm/postgres-js/migrator';

import env from '../config/env';
import { db } from '../db/client';
import { ensureDefaultCaseSettings } from '../db/seeds/case-settings';
import { ensureDefaultPermissions } from '../db/seeds/permissions';

export const runMigrationsAndSeeds = async () => {
  if (env.nodeEnv === 'test') {
    return;
  }

  await migrate(db, { migrationsFolder: './drizzle' });
  await ensureDefaultPermissions();
  await ensureDefaultCaseSettings();
};
