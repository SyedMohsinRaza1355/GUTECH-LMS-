// ==============================================================================
// GUTech Internal LMS - Announcement Routes
// ==============================================================================

import { Router } from 'express';
import {
  listAnnouncements,
  createAnnouncement,
  patchAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead
} from '../controllers/announcementController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { createAnnouncementSchema } from '../schemas/index.js';

const router = Router();

router.use(requireAuth);

router.get('/', listAnnouncements);
router.post('/', requireRole('admin', 'teacher'), validateRequest({ body: createAnnouncementSchema }), createAnnouncement);
router.patch('/:id', requireRole('admin', 'teacher'), patchAnnouncement);
router.delete('/:id', requireRole('admin', 'teacher'), deleteAnnouncement);
router.post('/read', markAnnouncementRead);

export default router;
