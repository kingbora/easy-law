import { eq } from 'drizzle-orm';

import { auth } from '../../auth';
import env from '../../config/env';
import { db } from '../client';
import { users } from '../schema';

export const ensureSeedUser = async () => {
  if (!env.defaultUserEmail || !env.defaultUserPassword) {
    return;
  }

  const existing = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.email, env.defaultUserEmail))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await auth.api.signUpEmail({
    body: {
      email: env.defaultUserEmail,
      password: env.defaultUserPassword,
      name: env.defaultUserName,
      image: undefined
    },
    asResponse: false
  });
};
