const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPublication() {
  const { data, error } = await supabase.rpc("check_realtime_publication");
  if (error) {
    // try direct query if we have an edge function for it?
    console.log("No RPC. Error:", error.message);
  } else {
    console.log(data);
  }
}
checkPublication();
