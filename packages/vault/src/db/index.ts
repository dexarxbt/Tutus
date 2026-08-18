import { getDb, saveDb, closeDb } from './connection.js';
import { createSchema } from './schema.js';
import { seedDatabase } from './seed.js';

export { getDb, saveDb, closeDb };

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();
  createSchema(db);
  await seedDatabase(db);
  saveDb();
}
