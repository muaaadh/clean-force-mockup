/* Which backend the site talks to.
   'local'    = demo data in each visitor's browser (no server). Logins: phone 7771234 + code 1234, admin / cleanforce.
   'supabase' = the live database. Fill in the project URL and the public anon key (Supabase > Project settings > API).
   The anon key is safe to ship: row level security in supabase/migrations decides what each visitor can read or write. */
window.CF_CONFIG = {
  backend: 'local',
  supabaseUrl: '',
  supabaseAnonKey: ''
};
