import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';

const router = Router();

router.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const db = await getDb();
  const result = db.exec('SELECT id, email, password_hash, name, role, org_id FROM users WHERE email = ?', [email]);

  if (result.length === 0 || result[0].values.length === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const row = result[0].values[0];
  const user = {
    id: row[0] as number,
    email: row[1] as string,
    password_hash: row[2] as string,
    name: row[3] as string,
    role: row[4] as string,
    org_id: row[5] as number,
  };

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Set session
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.userRole = user.role;
  req.session.userName = user.name;
  req.session.orgId = user.org_id;

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

router.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ success: true });
  });
});

router.get('/api/me', (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
    role: req.session.userRole,
    orgId: req.session.orgId,
  });
});

export default router;
