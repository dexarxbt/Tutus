import { Database } from 'sql.js';
import bcrypt from 'bcryptjs';

export async function seedDatabase(db: Database): Promise<void> {
  // Check if already seeded
  const result = db.exec('SELECT COUNT(*) as count FROM organizations');
  if (result.length > 0 && result[0].values[0][0] as number > 0) {
    return; // Already seeded
  }

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const employeePasswordHash = await bcrypt.hash('employee123', 10);

  // Create organization
  db.run(
    `INSERT INTO organizations (id, name, payout_account, plan) VALUES (1, 'Acme Corp', 'ACME-BANK-001', 'pro')`
  );

  // Create admin user
  db.run(
    `INSERT INTO users (id, email, password_hash, name, role, org_id) VALUES (1, 'admin@acme.com', ?, 'Alice Admin', 'admin', 1)`,
    [adminPasswordHash]
  );

  // Create employee user
  db.run(
    `INSERT INTO users (id, email, password_hash, name, role, org_id) VALUES (2, 'employee@acme.com', ?, 'Bob Employee', 'employee', 1)`,
    [employeePasswordHash]
  );

  // Create additional team members (as users)
  const memberHash = await bcrypt.hash('member123', 10);
  db.run(
    `INSERT INTO users (id, email, password_hash, name, role, org_id) VALUES (3, 'carol@acme.com', ?, 'Carol Member', 'employee', 1)`,
    [memberHash]
  );
  db.run(
    `INSERT INTO users (id, email, password_hash, name, role, org_id) VALUES (4, 'dave@acme.com', ?, 'Dave Member', 'employee', 1)`,
    [memberHash]
  );
  db.run(
    `INSERT INTO users (id, email, password_hash, name, role, org_id) VALUES (5, 'eve@acme.com', ?, 'Eve Member', 'employee', 1)`,
    [memberHash]
  );

  // Create team_members records
  db.run(`INSERT INTO team_members (user_id, org_id) VALUES (1, 1)`);
  db.run(`INSERT INTO team_members (user_id, org_id) VALUES (2, 1)`);
  db.run(`INSERT INTO team_members (user_id, org_id) VALUES (3, 1)`);
  db.run(`INSERT INTO team_members (user_id, org_id) VALUES (4, 1)`);
  db.run(`INSERT INTO team_members (user_id, org_id) VALUES (5, 1)`);

  // Create invoices
  db.run(
    `INSERT INTO invoices (org_id, amount, status, description) VALUES (1, 2499.00, 'paid', 'Pro Plan - January 2024')`
  );
  db.run(
    `INSERT INTO invoices (org_id, amount, status, description) VALUES (1, 2499.00, 'paid', 'Pro Plan - February 2024')`
  );
  db.run(
    `INSERT INTO invoices (org_id, amount, status, description) VALUES (1, 2499.00, 'pending', 'Pro Plan - March 2024')`
  );
  db.run(
    `INSERT INTO invoices (org_id, amount, status, description) VALUES (1, 549.00, 'paid', 'Additional Seats - Q1')`
  );
  db.run(
    `INSERT INTO invoices (org_id, amount, status, description) VALUES (1, 199.00, 'overdue', 'API Overage - February')`
  );
}
