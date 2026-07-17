// فقط Project URL و Publishable/anon key را قرار دهید.
// هرگز service_role key یا Database Password را در این فایل نگذارید.
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const supabaseClient = isSupabaseConfigured
  ? supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
