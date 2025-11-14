import { Router } from 'express';

import { departmentEnum } from '../db/schema/auth-schema';
import { getCaseClientById, listCaseClients, updateCaseClient } from '../services/cases-service';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

function sanitizeQueryParams(query: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(query)) {
    const value = Array.isArray(rawValue) ? rawValue[rawValue.length - 1] : rawValue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      sanitized[key] = trimmed;
      continue;
    }

    if (value !== undefined) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const query = sanitizeQueryParams(req.query);

    const page = typeof query.page === 'string' ? Number.parseInt(query.page, 10) : undefined;
    const pageSize = typeof query.pageSize === 'string' ? Number.parseInt(query.pageSize, 10) : undefined;
    const department =
      typeof query.department === 'string' &&
      (departmentEnum.enumValues as readonly string[]).includes(query.department)
        ? (query.department as (typeof departmentEnum.enumValues)[number])
        : undefined;
    const search = typeof query.search === 'string' ? query.search : undefined;

    const result = await listCaseClients(
      {
        page: Number.isFinite(page) ? page : undefined,
        pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
        department,
        search
      },
      session.user
    );

    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const client = await getCaseClientById(req.params.id, session.user);

    if (!client) {
      res.status(404).json({ message: '客户不存在' });
      return;
    }

    res.json(client);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const updated = await updateCaseClient(req.params.id, req.body, session.user);

    if (!updated) {
      res.status(404).json({ message: '客户不存在' });
      return;
    }

    res.json(updated);
  })
);

export default router;
