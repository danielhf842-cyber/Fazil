// ============================================================
//  FAZIL site configuration
// ============================================================
window.FAZIL_CONFIG = {
  // Supabase — safe to publish. The publishable key is designed for browser code;
  // Row Level Security in supabase-schema.sql is what protects the data.
  supabaseUrl:     "https://quiytibohpwfonyhgsev.supabase.co",
  supabaseAnonKey: "sb_publishable_7hC95KWzTQ7uomA31ds5kg_bdUTMkHY",

  // Fallback numbers, used only if Supabase is unreachable.
  // Edit the live values in the admin page (admin.html) instead.
  candidatesPlaced: 500,
  yearsExperience: 5,

  region: "United Kingdom"
};
