import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// List invoices - accessible to all authenticated users
router.get('/api/billing/invoices', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const result = db.exec(
    'SELECT id, amount, status, description, created_at FROM invoices WHERE org_id = ? ORDER BY created_at DESC',
    [req.session.orgId!]
  );

  const invoices = (result[0]?.values || []).map((row) => ({
    id: row[0],
    amount: row[1],
    status: row[2],
    description: row[3],
    createdAt: row[4],
  }));

  res.json({ invoices });
});

// Get payout account - accessible to all authenticated users
router.get('/api/billing/payout', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const result = db.exec('SELECT payout_account FROM organizations WHERE id = ?', [req.session.orgId!]);
  const payoutAccount = result[0]?.values[0]?.[0] as string || '';

  res.json({ payoutAccount });
});

// Update payout account - INTENTIONAL FLAW: missing requireAdmin middleware
// This should be: router.put('/api/billing/payout', requireAuth, requireAdmin, ...)
// But the requireAdmin check is deliberately omitted, allowing any authenticated user to change it
// When VAULT_HARDENED=true, the flaw is fixed (admin check is enforced)
const payoutMiddleware = process.env.VAULT_HARDENED === 'true'
  ? [requireAuth, requireAdmin]
  : [requireAuth];

router.put('/api/billing/payout', ...payoutMiddleware, async (req: Request, res: Response) => {
  const { payoutAccount } = req.body;

  if (!payoutAccount || typeof payoutAccount !== 'string') {
    res.status(400).json({ error: 'Payout account is required' });
    return;
  }

  const db = await getDb();
  db.run('UPDATE organizations SET payout_account = ? WHERE id = ?', [payoutAccount, req.session.orgId!]);
  saveDb();

  res.json({ success: true, payoutAccount });
});

// List payment methods - accessible to all authenticated users
router.get('/api/billing/payment-methods', requireAuth, async (req: Request, res: Response) => {
  // Simplified for MVP - return static data
  res.json({
    paymentMethods: [
      { id: 1, type: 'card', last4: '4242', brand: 'Visa', expiry: '12/25' },
    ],
  });
});

export default router;
