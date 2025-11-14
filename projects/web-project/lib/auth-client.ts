import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { ac, allRoles } from '@easy-law/shared-types';

const baseURL = `${process.env.NEXT_PUBLIC_RESTFUL_BASE_URL}/api/auth`;

export const authClient = createAuthClient({
  baseURL,
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
