import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { ac, allRoles } from '@easy-law/shared-types';

const isServer = typeof window === 'undefined' || process.env.NODE_ENV === 'development';
const baseURL = `${isServer ? 'http://localhost:4000' : window.location.origin }/restful/api/auth`;

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
