import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { ac, allRoles } from '@/../server-project/src/auth/permissions';

const baseURL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:4000/api/auth';

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
