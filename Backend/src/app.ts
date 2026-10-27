// ==============================================================================
// GUTech Internal LMS - Express Application Instance
// ==============================================================================

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Vercel's Express runtime uses the default export as the serverless handler.
export default app;

// Trust Vercel's single reverse-proxy hop so express-rate-limit can identify clients.
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS configuration - allow CLIENT_ORIGIN
app.use(
  cors({
    origin: [config.clientOrigin, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Request Body Parser (Strict 1MB limit per spec)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Non-negotiable Spec Rule 6 & Acceptance Criterion:
// No public sign-up anywhere: /signup returns 404
app.all('/signup', (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Public sign-up is disabled for GUTech internal portal. Accounts are provisioned exclusively by administration.'
    }
  });
});

app.all('/api/auth/signup', (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Sign-up endpoint does not exist.'
    }
  });
});

// Mount Main API routes under /api
app.use('/api', apiRouter);

// Fallback 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'API route not found'
    }
  });
});

// Central Error Handler
app.use(errorHandler);
