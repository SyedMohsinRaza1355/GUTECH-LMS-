// ==============================================================================
// GUTech Internal LMS - Complaint Routes
// ==============================================================================

import { Router } from 'express';
import {
  createComplaint,
  listMyComplaints
} from '../controllers/complaintController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { createComplaintSchema } from '../schemas/index.js';

const router = Router();

router.use(requireAuth);

router.post('/', validateRequest({ body: createComplaintSchema }), createComplaint);
router.get('/mine', listMyComplaints);

export default router;
