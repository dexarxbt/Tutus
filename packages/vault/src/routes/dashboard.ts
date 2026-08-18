import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/api/dashboard', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const orgId = req.session.orgId;

  const teamResult = db.exec('SELECT COUNT(*) FROM users WHERE org_id = ?', [orgId!]);
  const teamCount = teamResult[0]?.values[0][0] as number || 0;

  const invoiceResult = db.exec('SELECT COUNT(*) FROM invoices WHERE org_id = ?', [orgId!]);
  const invoiceCount = invoiceResult[0]?.values[0][0] as number || 0;

  const orgResult = db.exec('SELECT name, plan FROM organizations WHERE id = ?', [orgId!]);
  const org = orgResult[0]?.values[0];

  res.json({
    organization: {
      name: org?.[0] as string,
      plan: org?.[1] as string,
    },
    metrics: {
      teamMembers: teamCount,
      invoices: invoiceCount,
    },
  });
});

export default router;
