// AI Chatbot API route — injects comprehensive live context from the DB,
// then sends to GPT-4o-mini. Logs each interaction to chatbot_logs.
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
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string")
      return NextResponse.json({ error: "Message required" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, store_id, full_name, stores(name)")
      .eq("id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const role = profile.role as UserRole;
    const storeName = (profile.stores as unknown as { name: string } | null)?.name;
    const storeId = profile.store_id as string | null;
    const isStoreManager = role === "store_manager";

    const contextParts: string[] = [];

    // ── 1. Device catalogue ──────────────────────────────────────────────────
    const { data: allDevices } = await supabase
      .from("devices")
      .select("name, brand, sku, unit_price, status, low_stock_threshold")
      .order("brand").order("name");

    if (allDevices && allDevices.length > 0) {
      const active = allDevices.filter((d) => d.status === "active");
      const discontinued = allDevices.filter((d) => d.status !== "active");
      const lines = active.map(
        (d) => `  - ${d.brand} ${d.name} (${d.sku}): BD ${Number(d.unit_price).toFixed(3)}, min stock ${d.low_stock_threshold}`
      );
      contextParts.push(`## Device Catalogue (${active.length} active)\n${lines.join("\n")}${
        discontinued.length > 0 ? `\n  (${discontinued.length} discontinued/inactive devices not listed)` : ""
      }`);
    }

    // ── 2. Full inventory snapshot ───────────────────────────────────────────
    let invQuery = supabase
      .from("current_inventory_view")
      .select("device_name, brand, store_name, quantity, low_stock_threshold, stock_status, is_warehouse")
      .order("store_name").order("device_name");
    if (isStoreManager && storeId) invQuery = invQuery.eq("store_id", storeId);

    const { data: inventory } = await invQuery;
    if (inventory && inventory.length > 0) {
      const byStore: Record<string, typeof inventory> = {};
      for (const row of inventory) {
        const key = `${row.store_name}${row.is_warehouse ? " (Warehouse)" : ""}`;
        (byStore[key] ??= []).push(row);
      }
      const storeBlocks = Object.entries(byStore).map(([store, rows]) => {
        const items = rows.map(
          (r) => `    - ${r.brand} ${r.device_name}: ${r.quantity} units [${r.stock_status}]`
        );
        return `  ${store}:\n${items.join("\n")}`;
      });
      contextParts.push(`## Current Inventory\n${storeBlocks.join("\n")}`);
    }

    // ── 3. Active alerts ─────────────────────────────────────────────────────
    let alertQuery = supabase
      .from("alerts")
      .select("alert_type, message, severity, stores(name)")
      .eq("status", "active")
      .order("severity");
    if (isStoreManager && storeId) alertQuery = alertQuery.eq("store_id", storeId);
    const { data: alerts } = await alertQuery;
    if (alerts && alerts.length > 0) {
      const lines = alerts.map(
        (a) => `  - [${a.severity?.toUpperCase()}] ${(a.stores as unknown as { name: string } | null)?.name ?? "System"}: ${a.message}`
      );
      contextParts.push(`## Active Alerts (${alerts.length})\n${lines.join("\n")}`);
    } else {
      contextParts.push(`## Active Alerts\n  None`);
    }

    // ── 4. Sales history — last 12 months ───────────────────────────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const fromDate = twelveMonthsAgo.toISOString().split("T")[0];

    let salesQuery = supabase
      .from("monthly_sales_view")
      .select("sale_month, device_name, brand, store_name, total_units_sold, total_revenue")
      .gte("sale_month", fromDate)
      .order("sale_month", { ascending: false })
      .order("total_units_sold", { ascending: false });
    if (isStoreManager && storeId) salesQuery = salesQuery.eq("store_id", storeId);
    const { data: salesHistory } = await salesQuery;

    if (salesHistory && salesHistory.length > 0) {
      // Group by device for a summary
      const byDevice: Record<string, { units: number; revenue: number }> = {};
      for (const row of salesHistory) {
        const key = `${row.brand} ${row.device_name}`;
        if (!byDevice[key]) byDevice[key] = { units: 0, revenue: 0 };
        byDevice[key].units += Number(row.total_units_sold);
        byDevice[key].revenue += Number(row.total_revenue);
      }
      const sorted = Object.entries(byDevice)
        .sort((a, b) => b[1].units - a[1].units)
        .slice(0, 15);

      const summaryLines = sorted.map(
        ([name, d]) => `  - ${name}: ${d.units} units sold, BD ${d.revenue.toFixed(3)} revenue`
      );

      // Monthly breakdown (most recent 6 months)
      const byMonth: Record<string, { units: number; revenue: number }> = {};
      for (const row of salesHistory) {
        const month = String(row.sale_month).slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { units: 0, revenue: 0 };
        byMonth[month].units += Number(row.total_units_sold);
        byMonth[month].revenue += Number(row.total_revenue);
      }
      const monthLines = Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([month, d]) => `  - ${month}: ${d.units} units, BD ${d.revenue.toFixed(3)}`);

      contextParts.push(
        `## Sales History — Last 12 Months (top 15 devices by total units)\n${summaryLines.join("\n")}`
      );
      contextParts.push(
        `## Monthly Revenue Breakdown (last 6 months)\n${monthLines.join("\n")}`
      );
      contextParts.push(
        `## Raw Monthly Sales Data (for detailed queries)\nNote: ${salesHistory.length} monthly records available spanning ${fromDate} to today.`
      );
    }

    // ── 5. Transfers (recent 30, any status) ────────────────────────────────
    let transferQuery = supabase
      .from("transfers")
      .select("status, notes, transfer_date, created_at, from_store:source_store_id(name), to_store:destination_store_id(name), transfer_items(quantity, devices(name, brand))")
      .order("created_at", { ascending: false })
      .limit(30);
    if (isStoreManager && storeId)
      transferQuery = transferQuery.or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`);
    const { data: transfers } = await transferQuery;
    if (transfers && transfers.length > 0) {
      const byStatus: Record<string, number> = {};
      for (const t of transfers) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      const statusSummary = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ");
      const lines = transfers.slice(0, 15).map((t) => {
        const items = (t.transfer_items as unknown as { quantity: number; devices: { name: string; brand: string } | null }[])
          ?.map((i) => `${i.quantity}× ${i.devices?.brand} ${i.devices?.name}`)
          .join(", ") ?? "";
        return `  - [${t.status.toUpperCase()}] ${(t.from_store as unknown as { name: string } | null)?.name ?? "?"} → ${(t.to_store as unknown as { name: string } | null)?.name ?? "?"}: ${items}`;
      });
      contextParts.push(`## Recent Transfers (${statusSummary})\n${lines.join("\n")}`);
    }

    // ── 6. Forecasts ─────────────────────────────────────────────────────────
    let forecastQuery = supabase
      .from("forecasts")
      .select("predicted_demand, risk_level, forecast_month, devices(name, brand), stores(name)")
      .order("forecast_month", { ascending: false })
      .limit(30);
    if (isStoreManager && storeId) forecastQuery = forecastQuery.eq("store_id", storeId);
    const { data: forecasts } = await forecastQuery;
    if (forecasts && forecasts.length > 0) {
      const critical = forecasts.filter((f) => f.risk_level === "shortage_expected");
      const atRisk = forecasts.filter((f) => f.risk_level === "at_risk");
      const lines = [...critical, ...atRisk].slice(0, 15).map(
        (f) => `  - ${(f.devices as unknown as { brand: string; name: string } | null)?.brand} ${(f.devices as unknown as { brand: string; name: string } | null)?.name} @ ${(f.stores as unknown as { name: string } | null)?.name ?? "All"}: predicted ${f.predicted_demand} units [${f.risk_level}]`
      );
      contextParts.push(
        `## Demand Forecasts\n  Critical shortages: ${critical.length}, At risk: ${atRisk.length}\n${lines.join("\n")}`
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const contextBlock = contextParts.join("\n\n");
    const systemPrompt = buildSystemPrompt(role, storeName, today);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: `${systemPrompt}\n\n${contextBlock}` },
      ...(history as unknown as { role: "user" | "assistant"; content: string }[])
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.2,
    });

    const answer = completion.choices[0]?.message?.content ?? "Sorry, I could not generate a response.";
    const responseTime = Date.now() - start;

    supabase.from("chatbot_logs").insert({
      user_id: user.id,
      user_role: role,
      store_id: storeId,
      question: message,
      answer,
      status: "success",
      prompt_tokens: completion.usage?.prompt_tokens ?? null,
      completion_tokens: completion.usage?.completion_tokens ?? null,
      response_time_ms: responseTime,
    }).then(() => {});

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    console.error("[chatbot route]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
