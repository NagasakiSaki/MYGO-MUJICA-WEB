/**
 * Supabase client initialization
 */
const SUPABASE_URL = 'https://xciemvihmjbfwtslhfwq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaWVtdmlobWpiZnd0c2xoZndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTUwMTYsImV4cCI6MjA5NjAzMTAxNn0.P8l3AXiGrz1glw22NQLiXzf9uedMF8hFd6aWUHr_F68';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
