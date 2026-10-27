// ==============================================================================
// GUTech Internal LMS - Root API Router
// ==============================================================================

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import courseRoutes from './courseRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import quizRoutes from './quizRoutes.js';
import announcementRoutes from './announcementRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import marksRoutes from './marksRoutes.js';
import miscRoutes from './miscRoutes.js';

const apiRouter = Router();

// Health check endpoint (public, unauthenticated)
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'GUTech Internal LMS Backend API',
    timestamp: new Date().toISOString()
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/courses', courseRoutes);
apiRouter.use('/assignments', assignmentRoutes);
apiRouter.use('/quizzes', quizRoutes);
apiRouter.use('/announcements', announcementRoutes);
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/me', marksRoutes);
apiRouter.use('/', miscRoutes);

export default apiRouter;
