import { createAuthClient } from 'better-auth/client';

const baseURL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:4000/api/auth';

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include'
  }
});
