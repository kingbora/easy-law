import { defineConfig } from 'drizzle-kit';

import env from './src/config/env';

export default defineConfig({
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.databaseUrl
  },
  schema: './src/db/schema.ts'
});
