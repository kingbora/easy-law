import cors from 'cors';
import express from 'express';

import { errorHandler, notFoundHandler } from './middlewares/error-handlers';
import healthRouter from './routes/health';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin: string) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/health', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
