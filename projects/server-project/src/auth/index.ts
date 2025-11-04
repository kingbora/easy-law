import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { localization } from 'better-auth-localization';

import { AUTH_BASE_PATH } from '../app';
import { db } from '../db/client';
import { users, accounts, sessions, verifications } from '../db/schema/auth-schema';

import { ac, allRoles } from './permissions';
const isProduction = process.env.NODE_ENV === 'production';
const baseURL =
  isProduction 
      ? 'https://easy-lay.top' 
      : `http://localhost:3000`;

const basePath = AUTH_BASE_PATH;

export const auth = betterAuth({
  basePath,
  baseURL,
  plugins: [
    admin({
      ac,
      roles: allRoles,
      adminRoles: ['super_admin']
    }),
    localization({
      defaultLocale: 'zh-Hans',
    })
  ],
  user: {
    additionalFields: {
      department: {
        type: 'string',
        required: false,
        input: true // 这个字段会在个人资料页面显示为可编辑项
      },
      creatorId: {
        type: 'string',
        required: false,
        input: false
      },
      updaterId: {
        type: 'string',
        required: false,
        input: false
      },
      supervisorId: {
        type: 'string',
        required: false,
        input: true
      },
      gender: {
        type: 'string',
        required: false,
        input: true
      }
    }
  },
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
