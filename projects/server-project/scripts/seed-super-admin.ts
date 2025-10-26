/* eslint-disable no-console */
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { auth } from '../src/auth';
import { db, sql } from '../src/db/client';
import { users } from '../src/db/schema';

const EMAIL = 'super@qq.com';
const PASSWORD = 'a@000123';
const NAME = 'super';

async function main() {
  try {
    const existingUser = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);

    if (existingUser.length === 0) {
      await auth.api.signUpEmail({
        body: {
          email: EMAIL,
          password: PASSWORD,
          name: NAME,
          image: undefined
        },
        asResponse: false
      });
      console.log(`已创建超级管理员账号：${EMAIL}`);
    } else {
      console.log(`用户 ${EMAIL} 已存在，跳过创建步骤`);
    }

    await db
      .update(users)
      .set({
        role: 'super_admin',
        department: null,
        supervisorId: null,
        creatorId: 'system'
      })
      .where(eq(users.email, EMAIL));

    console.log(`已确保用户 ${EMAIL} 拥有 super_admin 角色`);
  } catch (error) {
    console.error('创建超级管理员账号失败', error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

void main();
