import { Router } from 'express';
import { joinWaitlist, getWaitlistCount } from './waitlist.controller';

const router = Router();

router.post('/join', joinWaitlist);
router.get('/count', getWaitlistCount);

export default router;
