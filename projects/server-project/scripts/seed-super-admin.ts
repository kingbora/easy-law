/* eslint-disable no-console */
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { auth } from '../src/auth';
import { db, sql } from '../src/db/client';
import { users } from '../src/db/schema';

const EMAIL = process.env.SUPER_ROLE_EMAIL;
const PASSWORD = process.env.SUPER_ROLE_PASSWORD;
const NAME = process.env.SUPER_ROLE_NICKNAME;

async function main() {
  try {
    if (!EMAIL || !PASSWORD || !NAME) {
      throw new Error('请在环境变量中设置 SUPER_ROLE_EMAIL、SUPER_ROLE_PASSWORD 和 SUPER_ROLE_NICKNAME');
    }
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
