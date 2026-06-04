import { createClient } from '@supabase/supabase-js';

const EXTERNAL_URL = 'https://gkldtnyitcuorwpntokt.supabase.co';
const EXTERNAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbGR0bnlpdGN1b3J3cG50b2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjMwODEsImV4cCI6MjA4NzczOTA4MX0.BKy89B-JvzOvUUaU-3GSQLB35_3ObrikrmKkbawlj-w';

export const externalDb = createClient(EXTERNAL_URL, EXTERNAL_KEY);
