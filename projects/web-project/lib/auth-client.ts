import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { ac, allRoles } from '@easy-law/shared-types';

const baseURL = `${process.env.NEXT_PUBLIC_WEBSITE_URL}/restful/api/auth`;

export const authClient = createAuthClient({
  baseURL,
  secret: process.env.NEXT_PUBLIC_BETTER_AUTH_SECRET,
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
