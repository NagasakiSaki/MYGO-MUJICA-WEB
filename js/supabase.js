/**
 * Supabase client initialization
 */
const SUPABASE_URL = 'https://mcrcshtpzzupaimsqavy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NXEhQXaTRClJitzLNzYXdQ_fHNFJl_L';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
