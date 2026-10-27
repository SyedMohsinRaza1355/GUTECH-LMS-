// ==============================================================================
// GUTech Internal LMS - Idempotent schema and RLS migration runner
// Demo Auth profiles are provisioned separately with `npm run db:seed-demo`.
// ==============================================================================

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL not found in Backend/.env');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase PostgreSQL database...');

const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase DB!');

    const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
    const files = [
      path.join(migrationsDir, '0001_initial_schema.sql'),
      path.join(migrationsDir, '0002_rls_policies.sql')
    ];

    for (const file of files) {
      if (fs.existsSync(file)) {
        console.log(`⏳ Executing: ${path.basename(file)}...`);
        const sql = fs.readFileSync(file, 'utf8');
        await client.query(sql);
        console.log(`✅ Successfully executed: ${path.basename(file)}`);
      } else {
        console.warn(`⚠️ File not found: ${file}`);
      }
    }

    console.log('\n🎉 SUPABASE SCHEMA & SECURITY POLICIES ARE APPLIED!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
