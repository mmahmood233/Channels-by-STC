/**
 * ============================================================================
 * Seed Users Script
 * ============================================================================
 * Creates all demo users in Supabase Auth and sets up their profiles.
 *
 * Usage:
 *   node scripts/seed-users.mjs
 *
 * Requirements:
 *   - .env.local must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load env from .env.local ─────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {
    console.error("❌  Could not read .env.local — make sure it exists.");
    process.exit(1);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

// Service role client — bypasses RLS, can create auth users
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Demo users to create ─────────────────────────────────────────────────────
const USERS = [
  {
    email: "admin@channels.com",
    password: "Admin@1234",
    full_name: "System Admin",
    role: "admin",
    store_id: null,
  },
  {
    email: "ahmed@channels.com",
    password: "Ahmed@1234",
    full_name: "Ahmed Al-Doseri",
    role: "store_manager",
    store_id: "b0000000-0000-0000-0000-000000000001", // Seef Branch
  },
  {
    email: "fatima@channels.com",
    password: "Fatima@1234",
    full_name: "Fatima Al-Khalifa",
    role: "store_manager",
    store_id: "b0000000-0000-0000-0000-000000000002", // City Centre Branch
  },
  {
    email: "hassan@channels.com",
    password: "Hassan@1234",
    full_name: "Hassan Al-Meer",
    role: "store_manager",
    store_id: "b0000000-0000-0000-0000-000000000003", // Riffa Branch
  },
  {
    email: "omar@channels.com",
    password: "Omar@1234",
    full_name: "Omar Al-Harbi",
    role: "warehouse_manager",
    store_id: null,
  },
];

// ── Helper ───────────────────────────────────────────────────────────────────
function pad(str, length = 30) {
  return str.padEnd(length, " ");
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Channels by stc — Seed Users Script       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of USERS) {
    process.stdout.write(`→ ${pad(user.email)} [${user.role}]  `);

    // 1. Create the auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // auto-confirm so they can log in immediately
        user_metadata: {
          full_name: user.full_name,
          role: user.role,
        },
      });

    if (authError) {
      if (authError.message?.toLowerCase().includes("already been registered")) {
        console.log("⚠️  Already exists — skipping");
        skipped++;
        continue;
      }
      console.log(`❌  Auth error: ${authError.message}`);
      failed++;
      continue;
    }

    const userId = authData.user.id;

    // 2. Upsert the profile row
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        store_id: user.store_id,
        status: "active",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.log(`❌  Profile error: ${profileError.message}`);
      failed++;
      continue;
    }

    console.log("✅  Created");
    created++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────────");
  console.log(`  ✅  Created : ${created}`);
  console.log(`  ⚠️   Skipped : ${skipped}`);
  console.log(`  ❌  Failed  : ${failed}`);
  console.log("──────────────────────────────────────────────\n");

  if (created > 0 || skipped > 0) {
    console.log("📋  Demo credentials:\n");
    console.log(
      "  Role               Email                     Password"
    );
    console.log(
      "  ─────────────────  ────────────────────────  ────────────"
    );
    for (const u of USERS) {
      console.log(
        `  ${pad(u.role, 17)}  ${pad(u.email, 24)}  ${u.password}`
      );
    }
    console.log();
  }

  if (failed > 0) {
    console.error(
      "⚠️  Some users failed to create. Check errors above and verify your SERVICE_ROLE_KEY is correct.\n"
    );
    process.exit(1);
  }
}

seedUsers().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
