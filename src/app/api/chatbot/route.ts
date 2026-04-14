import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/openai/prompts";
import OpenAI from "openai";
import type { UserRole } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, store_id, full_name, stores(name)")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    const role = profile.role as UserRole;
    const storeName = (profile.stores as unknown as { name: string } | null)?.name;
    const storeId = profile.store_id;

    // ── Gather context data from the DB ──────────────────────────────────────
    const contextParts: string[] = [];

    // 1. Summary stats
    const [
      { count: totalDevices },
      { count: activeAlerts },
      { data: lowStockItems },
      { data: pendingTransfers },
    ] = await Promise.all([
      supabase.from("devices").select("id", { count: "exact", head: true }).eq("status", "active"),
      (() => {
        let q = supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active");
        if (role === "store_manager" && storeId) q = q.eq("store_id", storeId);
        return q;
      })(),
      (() => {
        let q = supabase
          .from("current_inventory_view")
          .select("device_name, store_name, quantity, low_stock_threshold, stock_status")
          .in("stock_status", ["low_stock", "out_of_stock"])
          .limit(20);
        if (role === "store_manager" && storeId) q = q.eq("store_id", storeId);
        return q;
      })(),
      (() => {
        let q = supabase
          .from("transfers")
          .select("id, status, from_store:source_store_id(name), to_store:destination_store_id(name)")
          .eq("status", "pending")
          .limit(10);
        if (role === "store_manager" && storeId)
          q = q.or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`);
        return q;
      })(),
    ]);

    // Monthly revenue this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startISO = startOfMonth.toISOString().split("T")[0];
    let revQuery = supabase.from("sales").select("total_amount").gte("sale_date", startISO);
    if (role === "store_manager" && storeId) revQuery = revQuery.eq("store_id", storeId);
    const { data: monthlySales } = await revQuery;
    const monthlyRevenue = monthlySales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;

    contextParts.push(`## System Snapshot
- Active device SKUs: ${totalDevices ?? 0}
- Monthly revenue so far: BD ${monthlyRevenue.toFixed(3)}
- Active alerts: ${activeAlerts ?? 0}
- Pending transfers: ${pendingTransfers?.length ?? 0}`);

    if (lowStockItems && lowStockItems.length > 0) {
      const lines = lowStockItems
        .map(
          (i) =>
            `  - ${i.device_name} @ ${i.store_name}: ${i.quantity} units (threshold ${i.low_stock_threshold}) — ${i.stock_status}`
        )
        .join("\n");
      contextParts.push(`## Low / Out of Stock Items\n${lines}`);
    }

    if (pendingTransfers && pendingTransfers.length > 0) {
      const lines = pendingTransfers
        .map(
          (t) =>
            `  - ${(t.from_store as unknown as { name: string } | null)?.name ?? "?"} → ${
              (t.to_store as unknown as { name: string } | null)?.name ?? "?"
            }`
        )
        .join("\n");
      contextParts.push(`## Pending Transfers\n${lines}`);
    }

    // Top 5 selling devices (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let topQuery = supabase
      .from("monthly_sales_view")
      .select("device_name, brand, total_units_sold, total_revenue, store_name")
      .gte("sale_month", thirtyDaysAgo.toISOString().split("T")[0])
      .order("total_units_sold", { ascending: false })
      .limit(5);
    if (role === "store_manager" && storeId) topQuery = topQuery.eq("store_id", storeId);
    const { data: topSelling } = await topQuery;
    if (topSelling && topSelling.length > 0) {
      const lines = topSelling
        .map((d) => `  - ${d.brand} ${d.device_name}: ${d.total_units_sold} units sold (BD ${Number(d.total_revenue).toFixed(3)})`)
        .join("\n");
      contextParts.push(`## Top Selling Devices (Last 30 Days)\n${lines}`);
    }

    const contextBlock = contextParts.join("\n\n");
    const systemPrompt = buildSystemPrompt(role, storeName);

    // ── Build message history ────────────────────────────────────────────────
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `${systemPrompt}\n\n${contextBlock}`,
      },
      // Include prior turns (max last 10)
      ...(history as unknown as { role: "user" | "assistant"; content: string }[])
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 600,
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content ?? "Sorry, I could not generate a response.";
    const responseTime = Date.now() - start;

    // Log to chatbot_logs (non-blocking)
    supabase
      .from("chatbot_logs")
      .insert({
        user_id: user.id,
        user_role: role,
        store_id: storeId,
        question: message,
        answer,
        status: "success",
        prompt_tokens: completion.usage?.prompt_tokens ?? null,
        completion_tokens: completion.usage?.completion_tokens ?? null,
        response_time_ms: responseTime,
      })
      .then(() => {});

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    console.error("[chatbot route]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
