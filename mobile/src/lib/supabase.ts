import { createClient } from '@supabase/supabase-js';

// From Supabase Dashboard → Project Settings → API: Project URL and anon public key.
// Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://jjwmfnqtxlpfaqxhtxef.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqd21mbnF0eGxwZmFxeGh0eGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwOTIxNjksImV4cCI6MjA1NTY2ODE2OX0.fMPhk3viZweMTfvLSf4oEf9ALFSWXYnrHzfEsFSqF20';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
