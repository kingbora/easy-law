import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { ac, allRoles } from '@easy-law/shared-types';

const baseURL = `${process.env.WEBSITE_URL}/restful/api/auth`;

console.log('Auth Client Secret:', process.env.BETTER_AUTH_SECRET);

export const authClient = createAuthClient({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [
    adminClient({
      ac,
      roles: allRoles,
    }),
  ],
  fetchOptions: {
    credentials: 'include'
  },
});
