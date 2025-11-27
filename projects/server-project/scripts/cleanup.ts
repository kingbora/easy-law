/* eslint-disable no-console */

import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1, ssl: false });

  try {
    console.log('开始数据清理...');

    // 简单的清理：将所有无效值设置为第一个有效枚举值
    const result = await sql`
      WITH valid_values AS (
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = 'litigation_fee_type'::regtype 
        ORDER BY enumsortorder 
        LIMIT 1
      )
      UPDATE case_record 
      SET litigation_fee_type = (SELECT enumlabel FROM valid_values)::litigation_fee_type
      WHERE litigation_fee_type NOT IN (
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = 'litigation_fee_type'::regtype
      )
      RETURNING id, litigation_fee_type
    `;

    console.log(`清理完成，更新了 ${result.length} 条记录`);

    if (result.length > 0) {
      console.log('更新的记录样例:', result.slice(0, 5));
    }

  } finally {
    await sql.end();
  }
}

void main();