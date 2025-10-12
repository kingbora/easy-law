import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import env from '../config/env';
import { db } from '../db/client';
import * as schema from '../db/schema';
const isProduction = env.nodeEnv === 'production';
const baseURL =
  isProduction 
      ? 'https://easy-lay.top' 
      : `http://localhost:3000`;

const basePath = process.env.AUTH_BASE_PATH ?? '/api/auth';

export const auth = betterAuth({
  basePath,
  baseURL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users
    },
    usePlural: true
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60
    }
  },
  advanced: {
    useSecureCookies: isProduction,
    cookieAttributes: {
      path: '/',
      sameSite: 'lax',
      secure: isProduction
    }
  }
});
