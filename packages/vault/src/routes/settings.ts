import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// Get organization settings - all authenticated users can view
router.get('/api/settings', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const result = db.exec('SELECT name, plan FROM organizations WHERE id = ?', [req.session.orgId!]);
  const org = result[0]?.values[0];

  res.json({
    name: org?.[0] as string,
    plan: org?.[1] as string,
  });
});

// Update organization settings - ADMIN only
router.put('/api/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Organization name is required' });
    return;
  }

  const db = await getDb();
  db.run('UPDATE organizations SET name = ? WHERE id = ?', [name, req.session.orgId!]);
  saveDb();

  res.json({ success: true, name });
});

export default router;
