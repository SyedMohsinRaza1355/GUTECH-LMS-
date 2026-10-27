// ==============================================================================
// GUTech Internal LMS - Server Entry Point
// ==============================================================================

import { app } from './app.js';
import { config, isSupabaseConfigured } from './config/index.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎓 GUTech Internal LMS API Server`);
  console.log(`🚀 Running at: http://localhost:${PORT}`);
  console.log(`🔒 Supabase Configured: ${isSupabaseConfigured() ? 'YES (Live Database)' : 'NO (Pre-seeded Mock Fallback)'}`);
  console.log(`🌐 Allowed Client: ${config.clientOrigin}`);
  console.log(`=======================================================`);
});
