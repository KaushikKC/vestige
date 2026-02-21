import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjwmfnqtxlpfaqxhtxef.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqd21mbnF0eGxwZmFxeGh0eGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwOTIxNjksImV4cCI6MjA1NTY2ODE2OX0.fMPhk3viZweMTfvLSf4oEf9ALFSWXYnrHzfEsFSqF20';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
