/* eslint-disable no-console */
import 'dotenv/config';

import { eq } from 'drizzle-orm';
import { Router } from 'express';
import postgres from 'postgres';

import { auth } from '../auth';
import { db, sql } from '../db/client';
import { users } from '../db/schema';

const EMAIL = process.env.SUPER_ROLE_EMAIL;
const PASSWORD = process.env.SUPER_ROLE_PASSWORD;
const NAME = process.env.SUPER_ROLE_NICKNAME;

const router = Router();

router.get('/seed', async (_req, res) => {
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

  res.json({ status: 'done' });
});

router.get('/reset', async (req, res) => {
  const session = req.sessionContext!;
  if (!session) {
    res.status(401).json({ error: '未认证的请求' });
    return;
  }
  if (session.user.role !== 'super_admin' || session.user.email !== EMAIL) {
    res.status(403).json({ error: '仅超级管理员可执行此操作' });
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.warn('Dropping schema "public" (cascade)...');
    await sql`drop schema if exists public cascade`;

    console.warn('Recreating schema "public"...');
    await sql`create schema public`;
    await sql`grant all on schema public to public`;
    await sql`grant all on schema public to current_user`;

    console.warn('Dropping schema "drizzle" (cascade)...');
    await sql`drop schema if exists drizzle cascade`;

    console.warn('Recreating schema "drizzle"...');
    await sql`create schema drizzle`;
     
    console.log('Database schemas reset. You can rerun migrations now.');
  } catch (error) {
    console.error('Failed to reset database schemas', error);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  res.json({ status: 'done' });
});

export default router;
