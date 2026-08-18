import { Request, Response, NextFunction } from 'express';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
    userEmail: string;
    userRole: string;
    userName: string;
    orgId: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.redirect('/login');
    }
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.userRole !== 'admin') {
    if (req.path.startsWith('/api/')) {
      res.status(403).json({ error: 'Admin access required' });
    } else {
      res.status(403).send('Forbidden');
    }
    return;
  }
  next();
}
