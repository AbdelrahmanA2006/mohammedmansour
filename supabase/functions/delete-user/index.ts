import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated." }, 401);

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || callerProfile?.role !== "coach") {
      return json({ error: "Only coaches can delete users." }, 403);
    }

    const body = await req.json();
    const targetId = (body.userId ?? "").trim();
    if (!targetId) return json({ error: "userId is required." }, 400);
    if (targetId === user.id) return json({ error: "You cannot delete your own account." }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // profiles row (and plans/check_ins/messages/payments via FK cascade) are
    // removed automatically when the auth user is deleted (on delete cascade).
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
    if (deleteError) return json({ error: deleteError.message }, 400);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error." }, 500);
  }
});
