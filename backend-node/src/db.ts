import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// A CA certificate also verifies the server's identity. Without one, the connection is
// encrypted but unverified, which is what Supabase's default certificate setup requires.
function sslConfig() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
  connectionTimeoutMillis: 10000,
});

// Hosted databases close idle connections, and without a listener that would crash the process
pool.on('error', (error) => {
  console.error('Idle Database Connection Error:', error.message);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
