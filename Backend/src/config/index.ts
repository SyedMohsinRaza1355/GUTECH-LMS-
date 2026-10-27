// ==============================================================================
// GUTech Internal LMS - Configuration & Supabase Client Setup
// ==============================================================================

import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
  databaseUrl: process.env.DATABASE_URL || '',
  passwordResetRedirect: process.env.PASSWORD_RESET_REDIRECT || 'http://localhost:5173/reset-password',
  jwtSecret: process.env.JWT_SECRET || 'gutech-lms-jwt-secret-2026'
};

// Check if actual Supabase URL is provided
export const isSupabaseConfigured = () => {
  return (
    config.nodeEnv !== 'test' &&
    config.supabaseUrl &&
    !config.supabaseUrl.includes('placeholder') &&
    config.supabaseAnonKey &&
    !config.supabaseAnonKey.includes('placeholder') &&
    config.supabaseServiceRoleKey &&
    !config.supabaseServiceRoleKey.includes('placeholder')
  );
};

// Supabase client with Anon Key (for client operations)
export const supabaseAnon: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Supabase client with Service Role Key (for administrative tasks: user management, signed URLs)
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
