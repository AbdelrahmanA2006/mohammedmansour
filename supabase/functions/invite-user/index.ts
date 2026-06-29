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

    // Client scoped to the caller's own JWT — used only to verify identity + role.
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
      return json({ error: "Only coaches can invite users." }, 403);
    }

    const body = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();
    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const goal = (body.goal ?? "bulk").trim();
    const notes = (body.notes ?? "").trim();
    const role = body.role === "coach" ? "coach" : "client";

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return json({ error: "A valid email is required." }, 400);
    }
    if (!name) return json({ error: "Name is required." }, 400);

    // Admin client — service role key never leaves this server-side function.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const redirectTo = body.redirectTo || undefined;

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { name, phone, goal, notes, role },
        redirectTo,
      },
    );

    if (inviteError) {
      const msg = inviteError.message?.toLowerCase().includes("already been registered")
        ? "An account with this email already exists."
        : inviteError.message;
      return json({ error: msg }, 400);
    }

    return json({ ok: true, userId: invited.user?.id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error." }, 500);
  }
});
