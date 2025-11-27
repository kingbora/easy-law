import { USER_DEPARTMENTS, type TrialStage, type UserDepartment } from '@easy-law/shared-types';
import { Router } from 'express';

import { getDepartmentMenuConfig, updateDepartmentMenuConfig } from '../services/menu-config-service';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

function normalizeDepartment(value: unknown): UserDepartment | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return (USER_DEPARTMENTS as readonly string[]).includes(trimmed as UserDepartment)
    ? (trimmed as UserDepartment)
    : undefined;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const department = normalizeDepartment(req.query.department);
    const config = await getDepartmentMenuConfig(department, session.user);
    res.json({ data: config });
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const department = normalizeDepartment(body.department);
    const dataSources = Array.isArray(body.dataSources) ? body.dataSources : undefined;
  const trialStages = Array.isArray(body.trialStages) ? (body.trialStages as TrialStage[]) : undefined;

    const config = await updateDepartmentMenuConfig(
      department,
      {
        dataSources,
        trialStages
      },
      session.user
    );

    res.json({ data: config });
  })
);

export default router;
