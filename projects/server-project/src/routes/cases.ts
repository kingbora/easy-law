import { Router } from 'express';

import {
  createCase,
  createCaseCollection,
  deleteCase,
  getAssignableStaff,
  getCaseById,
  getCaseHearings,
  getCaseChangeLogs,
  listCases,
  updateCase,
  updateCaseTimeNodes
} from '../services/cases-service';
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

    const result = await listCases(req.query, session.user);

    res.json(result);
  })
);

router.get(
  '/assignable-staff',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const query = sanitizeQueryParams(req.query);
    const department = typeof query.department === 'string' ? query.department : undefined;
    const result = await getAssignableStaff(session.user, department);
    res.json({ data: result });
  })
);

router.get(
  '/:id/change-logs',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const logs = await getCaseChangeLogs(req.params.id, session.user);

    if (!logs) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.json({ data: logs });
  })
);

router.get(
  '/:id/hearings',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const hearings = await getCaseHearings(req.params.id, session.user);

    if (!hearings) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.json({ data: hearings });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const record = await getCaseById(req.params.id, session.user);
    if (!record) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.json({ data: record });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const created = await createCase(req.body, session.user);
    res.status(201).json({ data: created });
  })
);

router.post(
  '/:id/collections',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const created = await createCaseCollection(req.params.id, req.body, session.user);

    if (!created) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.status(201).json({ data: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const updated = await updateCase(req.params.id, req.body, session.user);

    if (!updated) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.json({ data: updated });
  })
);

router.put(
  '/:id/time-nodes',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const payload = Array.isArray(req.body) ? req.body : req.body?.timeNodes;

    if (!Array.isArray(payload) || payload.length === 0) {
      res.status(400).json({ message: '请提供要更新的时间节点' });
      return;
    }

    const updated = await updateCaseTimeNodes(req.params.id, payload, session.user);

    if (!updated) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.json({ data: updated });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;

    const deletedId = await deleteCase(req.params.id, session.user);

    if (!deletedId) {
      res.status(404).json({ message: 'Case not found' });
      return;
    }

    res.status(204).send();
  })
);

export default router;
