import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDb, saveDb } from './db/index.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import billingRoutes from './routes/billing.js';
import settingsRoutes from './routes/settings.js';
import teamRoutes from './routes/team.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.VAULT_PORT ? parseInt(process.env.VAULT_PORT) : 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: 'vault-session-secret-dev',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API Routes
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(billingRoutes);
app.use(settingsRoutes);
app.use(teamRoutes);

// Page Routes (server-rendered)
app.get('/login', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
    return;
  }
  res.render('login', { title: 'Login', page: 'login', user: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await getDb();

  const result = db.exec('SELECT id, email, password_hash, name, role, org_id FROM users WHERE email = ?', [email]);

  if (result.length === 0 || result[0].values.length === 0) {
    res.render('login', { title: 'Login', page: 'login', user: null, error: 'Invalid credentials' });
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

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.render('login', { title: 'Login', page: 'login', user: null, error: 'Invalid credentials' });
    return;
  }

  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.userRole = user.role;
  req.session.userName = user.name;
  req.session.orgId = user.org_id;

  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const db = await getDb();
  const orgResult = db.exec('SELECT name, plan FROM organizations WHERE id = ?', [req.session.orgId!]);
  const teamResult = db.exec('SELECT COUNT(*) FROM users WHERE org_id = ?', [req.session.orgId!]);
  const invoiceResult = db.exec('SELECT COUNT(*) FROM invoices WHERE org_id = ?', [req.session.orgId!]);

  const org = { name: orgResult[0]?.values[0]?.[0] as string, plan: orgResult[0]?.values[0]?.[1] as string };
  const metrics = {
    teamMembers: teamResult[0]?.values[0]?.[0] as number,
    invoices: invoiceResult[0]?.values[0]?.[0] as number,
  };

  res.render('dashboard', { title: 'Dashboard', page: 'dashboard', user: req.session, org, metrics });
});

app.get('/team', requireAuth, async (req, res) => {
  const db = await getDb();
  const result = db.exec(
    'SELECT id, email, name, role, created_at FROM users WHERE org_id = ? ORDER BY created_at',
    [req.session.orgId!]
  );

  const members = (result[0]?.values || []).map((row) => ({
    id: row[0],
    email: row[1],
    name: row[2],
    role: row[3],
    createdAt: row[4],
  }));

  res.render('team', { title: 'Team', page: 'team', user: req.session, members });
});

app.post('/team/invite', requireAuth, (req, res) => {
  // Just redirect back for MVP
  res.redirect('/team');
});

app.get('/billing', requireAuth, async (req, res) => {
  const db = await getDb();
  const result = db.exec(
    'SELECT id, amount, status, description, created_at FROM invoices WHERE org_id = ? ORDER BY created_at DESC',
    [req.session.orgId!]
  );

  const invoices = (result[0]?.values || []).map((row) => ({
    id: row[0],
    amount: row[1] as number,
    status: row[2],
    description: row[3],
    createdAt: row[4],
  }));

  res.render('billing', { title: 'Billing', page: 'billing', user: req.session, invoices });
});

app.get('/billing/payout', requireAuth, async (req, res) => {
  const db = await getDb();
  const result = db.exec('SELECT payout_account FROM organizations WHERE id = ?', [req.session.orgId!]);
  const payoutAccount = result[0]?.values[0]?.[0] as string || '';

  res.render('payout', { title: 'Payout Account', page: 'payout', user: req.session, payoutAccount });
});

app.post('/billing/payout', requireAuth, async (req, res) => {
  // In hardened mode, enforce admin check on form POST too
  if (process.env.VAULT_HARDENED === 'true' && req.session.userRole !== 'admin') {
    res.status(403).send('Forbidden');
    return;
  }
  const { payoutAccount } = req.body;
  const db = await getDb();
  db.run('UPDATE organizations SET payout_account = ? WHERE id = ?', [payoutAccount, req.session.orgId!]);
  saveDb();

  res.render('payout', { title: 'Payout Account', page: 'payout', user: req.session, payoutAccount, success: true });
});

app.get('/settings', requireAuth, async (req, res) => {
  const db = await getDb();
  const result = db.exec('SELECT name, plan FROM organizations WHERE id = ?', [req.session.orgId!]);
  const org = { name: result[0]?.values[0]?.[0] as string, plan: result[0]?.values[0]?.[1] as string };

  res.render('settings', { title: 'Settings', page: 'settings', user: req.session, org });
});

app.post('/settings', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    res.status(403).send('Forbidden');
    return;
  }
  const { name } = req.body;
  const db = await getDb();
  db.run('UPDATE organizations SET name = ? WHERE id = ?', [name, req.session.orgId!]);
  saveDb();
  res.redirect('/settings');
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect(req.session.userId ? '/dashboard' : '/login');
});

// Start server
async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`[Vault] Running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);

export { app };
