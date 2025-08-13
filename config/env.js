import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Expose commonly used vars
export const PORT = Number(process.env.PORT) || 3000;
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'my-bucket';

// Warn if required variables are missing (non-fatal, matches current behavior)
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_KEY'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `Missing environment variables: ${missing.join(', ')}. Some routes will fail until these are set.`,
  );
}


