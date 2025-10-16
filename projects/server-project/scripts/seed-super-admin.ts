/* eslint-disable no-console */
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { auth } from '../src/auth';
import { db, sql } from '../src/db/client';
import { users } from '../src/db/schema';

const EMAIL = 'super@qq.com';
const PASSWORD = 'a@000123';
const NAME = 'super';
const ROLE: typeof users.$inferSelect['role'] = 'master';

async function main() {
  try {
    const existingUser = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);

    if (existingUser.length > 0) {
      const user = existingUser[0];
      if (user.role !== ROLE) {
        await db.update(users).set({ role: ROLE, updatedAt: new Date() }).where(eq(users.id, user.id));
        console.log(`用户 ${EMAIL} 已存在，角色已更新为 ${ROLE}`);
      } else {
        console.log(`用户 ${EMAIL} 已存在，角色保持为 ${ROLE}`);
      }
      return;
    }

    await auth.api.signUpEmail({
      body: {
        email: EMAIL,
        password: PASSWORD,
        name: NAME,
        image: undefined
      },
      asResponse: false
    });

    await db
      .update(users)
      .set({
        role: ROLE,
        updatedAt: new Date()
      })
      .where(eq(users.email, EMAIL));

    console.log(`已创建超级管理员账号：${EMAIL}`);
  } catch (error) {
    console.error('创建超级管理员账号失败', error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

void main();
