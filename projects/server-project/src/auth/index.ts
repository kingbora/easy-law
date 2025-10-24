import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { localization } from 'better-auth-localization';

import { db } from '../db/client';
import { users, accounts, sessions, verifications } from '../db/schema/auth-schema';
import { ac, allRoles } from './permissions';
const isProduction = process.env.NODE_ENV === 'production';
const baseURL =
  isProduction 
      ? 'https://easy-lay.top' 
      : `http://localhost:3000`;

const basePath = process.env.AUTH_BASE_PATH ?? '/api/auth';

export const auth = betterAuth({
  basePath,
  baseURL,
  plugins: [
    admin({
      ac,
      roles: allRoles,
      adminRoles: ['super_admin'],
    }),
    localization({
      defaultLocale: 'zh-Hans',
    })
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      verification: verifications,
      session: sessions,
      account: accounts,
      user: users,
    },
  }),
  emailAndPassword: {
    enabled: true
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60
    }
  },
});
