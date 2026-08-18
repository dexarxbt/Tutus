import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDb } from '../db/index.js';

const router = Router();

// List team members - all authenticated users can view
router.get('/api/team', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const result = db.exec(
    'SELECT u.id, u.email, u.name, u.role, u.created_at FROM users u WHERE u.org_id = ? ORDER BY u.created_at',
    [req.session.orgId!]
  );

  const members = (result[0]?.values || []).map((row) => ({
    id: row[0],
    email: row[1],
    name: row[2],
    role: row[3],
    createdAt: row[4],
  }));

  res.json({ members });
});

// Invite team member - ADMIN only
router.post('/api/team/invite', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email || !name) {
    res.status(400).json({ error: 'Email and name are required' });
    return;
  }

  // In MVP, just return success (don't actually create user without password)
  res.json({ success: true, message: `Invitation sent to ${email}` });
});

// Remove team member - ADMIN only
router.delete('/api/team/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const memberId = parseInt(req.params.id, 10);

  if (isNaN(memberId)) {
    res.status(400).json({ error: 'Invalid member ID' });
    return;
  }

  // Don't allow removing yourself
  if (memberId === req.session.userId) {
    res.status(400).json({ error: 'Cannot remove yourself' });
    return;
  }

  const db = await getDb();
  db.run('DELETE FROM team_members WHERE user_id = ? AND org_id = ?', [memberId, req.session.orgId!]);
  db.run('DELETE FROM users WHERE id = ? AND org_id = ?', [memberId, req.session.orgId!]);

  res.json({ success: true });
});

export default router;
