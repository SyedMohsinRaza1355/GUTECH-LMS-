// ==============================================================================
// GUTech Internal LMS - Global Error Handling Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || []
      }
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }
    });
  }

  // Check for multer file size error
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message
      }
    });
  }

  console.error('[UNHANDLED_EXCEPTION]:', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred'
    }
  });
};
