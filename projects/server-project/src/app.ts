import { toNodeHandler } from 'better-auth/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { auth } from './auth';
import env from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error-handlers';
import caseSettingsRouter from './routes/case-settings';
import casesRouter from './routes/cases';
import clientsRouter from './routes/clients';
import dashboardRouter from './routes/dashboard';
import healthRouter from './routes/health';
import lawyersRouter from './routes/lawyers';
import maintainersRouter from './routes/maintainers';
import permissionsRouter from './routes/permissions';
import usersRouter from './routes/users';

const app = express();

const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  })
);
app.all('/api/auth/*', toNodeHandler(auth));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/lawyers', lawyersRouter);
app.use('/api/maintainers', maintainersRouter);
app.use('/api/cases', casesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/case-settings', caseSettingsRouter);
app.use('/api/permissions', permissionsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
