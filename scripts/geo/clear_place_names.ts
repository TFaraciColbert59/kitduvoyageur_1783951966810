// scripts/clear_place_names.ts — Delete all rows from place_names_geo to free storage
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function clear() {
  const { error, count } = await supabase
    .from("place_names_geo")
    .delete()
    .neq("geoname_id", "-1")
    .select();
  if (error) {
    console.error("Delete error:", error.message);
    process.exit(1);
  }
  console.log(`Deleted ${count ?? 0} rows from place_names_geo`);
}

clear().catch((e) => {
  console.error(e);
  process.exit(1);
});
