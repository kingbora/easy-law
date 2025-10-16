import { and, eq } from 'drizzle-orm';

import { db } from '../client';
import { caseCategories, caseTypes } from '../schema';

interface DefaultCaseConfig {
  name: string;
  description?: string | null;
  categories: string[];
}

const DEFAULT_CASE_SETTINGS: DefaultCaseConfig[] = [
  {
    name: '民事案件',
    categories: ['合同纠纷', '劳动争议', '物权纠纷', '侵权责任纠纷', '婚姻家庭与继承纠纷', '公司与证券纠纷', '知识产权纠纷']
  },
  {
    name: '刑事案件',
    categories: ['辩护业务', '具体罪名']
  },
  {
    name: '行政案件',
    categories: ['行政诉讼']
  },
  {
    name: '非诉业务',
    categories: ['法律顾问', '投融资与并购', '资本市场', '内部合规与风控']
  }
];

export const ensureDefaultCaseSettings = async () => {
  await db.transaction(async (trx) => {
    for (const config of DEFAULT_CASE_SETTINGS) {
      const [existingType] = await trx
        .select({ id: caseTypes.id })
        .from(caseTypes)
        .where(eq(caseTypes.name, config.name))
        .limit(1);

      let caseTypeId: string;

      if (!existingType) {
        const [inserted] = await trx
          .insert(caseTypes)
          .values({
            name: config.name,
            description: config.description ?? null,
            isSystem: true
          })
          .returning({ id: caseTypes.id });

        if (!inserted) {
          continue;
        }
        caseTypeId = inserted.id;
      } else {
        caseTypeId = existingType.id;
        await trx
          .update(caseTypes)
          .set({
            description: config.description ?? null,
            isSystem: true,
            updatedAt: new Date()
          })
          .where(eq(caseTypes.id, caseTypeId));
      }

      for (const [index, categoryName] of config.categories.entries()) {
        const [existingCategory] = await trx
          .select({ id: caseCategories.id })
          .from(caseCategories)
          .where(and(eq(caseCategories.caseTypeId, caseTypeId), eq(caseCategories.name, categoryName)))
          .limit(1);

        if (!existingCategory) {
          await trx.insert(caseCategories).values({
            caseTypeId,
            name: categoryName,
            sortIndex: index,
            isSystem: true
          });
        } else {
          await trx
            .update(caseCategories)
            .set({
              sortIndex: index,
              isSystem: true,
              updatedAt: new Date()
            })
            .where(eq(caseCategories.id, existingCategory.id));
        }
      }
    }
  });
};
