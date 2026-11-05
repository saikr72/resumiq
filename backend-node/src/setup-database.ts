// Applies the schema and all migrations to DATABASE_URL. Safe to run more than once.
// Run with: npm run db:setup
import fs from 'fs';
import path from 'path';
import pool from './db';

const DATABASE_DIR = path.resolve(__dirname, '../../database');

async function main() {
  const migrationsDir = path.join(DATABASE_DIR, 'migrations');
  const files = [
    path.join(DATABASE_DIR, 'schema.sql'),
    ...fs.readdirSync(migrationsDir).sort().map((name) => path.join(migrationsDir, name)),
  ];

  for (const file of files) {
    await pool.query(fs.readFileSync(file, 'utf8'));
    console.log(`Applied ${path.basename(file)}`);
  }

  const tables = await pool.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE rowsecurity)::int AS protected
     FROM pg_tables WHERE schemaname = 'public'`
  );
  const { total, protected: isProtected } = tables.rows[0];
  console.log(`Done: ${total} tables, ${isProtected} with Row Level Security on`);

  if (total !== isProtected) {
    throw new Error('Some tables do not have Row Level Security on');
  }
}

main()
  .catch((error) => {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
