import "./utils/sentry-config";
import * as Sentry from "@sentry/node"
import { toNodeHandler } from 'better-auth/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { auth } from './auth';
import { AUTH_BASE_PATH } from './constants';
import { requireSession } from './middlewares/session';
import calendarEventsRouter from './routes/calendar-events';
import casesRouter from './routes/cases';
import clientsRouter from './routes/clients';
import seedRouter from './routes/db-opts';
import profileRouter from './routes/profile';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const allowedOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  })
);
app.all(`${AUTH_BASE_PATH}/*`, toNodeHandler(auth));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/restful/api/cases', requireSession, casesRouter);
app.use('/restful/api/clients', requireSession, clientsRouter);
app.use('/restful/api/calendar-events', requireSession, calendarEventsRouter);
app.use('/restful/api/profile', requireSession, profileRouter);
app.use('/restful/api/db', requireSession, seedRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

Sentry.setupExpressErrorHandler(app);

export default app;
