import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Called BEFORE the user has a session (right after a failed login attempt),
// so this cannot require a JWT. It only answers a yes/no existence question
// to turn Supabase's generic "Invalid login credentials" into a precise
// "Account does not exist." vs "Incorrect password." message. It never
// touches passwords and never returns anything else about the account.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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
    const body = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return json({ error: "A valid email is required." }, 400);
    }

    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      },
    );

    if (!res.ok) {
      return json({ error: "Could not verify account." }, 500);
    }

    const data = await res.json();
    const users = Array.isArray(data.users) ? data.users : [];
    const exists = users.some((u: { email?: string }) => u.email?.toLowerCase() === email);

    return json({ exists });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error." }, 500);
  }
});
