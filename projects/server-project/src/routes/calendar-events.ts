import { Router } from 'express';

import {
  createCustomCalendarEvent,
  deleteCustomCalendarEvent,
  listCalendarEvents
} from '../services/calendar-events-service';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const events = await listCalendarEvents(session.user);
    res.json({ data: events });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const created = await createCustomCalendarEvent(req.body, session.user);
    res.status(201).json({ data: created });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = req.sessionContext!;
    const deleted = await deleteCustomCalendarEvent(req.params.id, session.user);

    if (!deleted) {
      res.status(404).json({ message: '未找到对应的日程事件' });
      return;
    }

    res.status(204).send();
  })
);

export default router;
