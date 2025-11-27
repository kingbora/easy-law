import { ac, allRoles } from '@easy-law/shared-types';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { localization } from 'better-auth-localization';

import { AUTH_BASE_PATH } from '../constants';
import { db } from '../db/client';
import { users, accounts, sessions, verifications } from '../db/schema/auth-schema';

const isProduction = process.env.NODE_ENV === 'production';
const baseURL =
  isProduction 
      ? `https://${process.env.WEBSITE_DOMAIN}`
      : `http://localhost:3000`;

const basePath = AUTH_BASE_PATH;

export const auth = betterAuth({
  basePath,
  baseURL,
  secret: isProduction ? process.env.BETTER_AUTH_SECRET : undefined,
  trustedOrigins: isProduction ? [
    `https://${process.env.WEBSITE_DOMAIN}`,
    `https://www.${process.env.WEBSITE_DOMAIN}`,
  ] : [baseURL],
  advanced: {
    useSecureCookies: false, // 本地环境使用 HTTP，禁用 Secure Cookie 避免 401
    disableCSRFCheck: false,
    ipAddress: {
      disableIpTracking: true,
    },
    crossSubDomainCookies: {
      enabled: isProduction,
      domain: isProduction ? `.${process.env.WEBSITE_DOMAIN}` : undefined,
    },
  },
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
});
