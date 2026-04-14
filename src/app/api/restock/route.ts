import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RestockSuggestion {
  deviceId: string;
  deviceName: string;
  brand: string;
  sku: string;
  storeId: string;
  storeName: string;
  currentStock: number;
  predictedDemand: number;
  suggestedQty: number;
  urgency: "critical" | "high" | "medium";
  reason: string;
  warehouseStoreId: string;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role, store_id").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Gather all the data AI needs
    const [
      { data: lowStock },
      { data: forecasts },
      { data: topSelling },
      { data: stores },
    ] = await Promise.all([
      // Current low/out of stock items
      supabase
        .from("current_inventory_view")
        .select("device_id, device_name, brand, sku, store_id, store_name, is_warehouse, quantity, low_stock_threshold, stock_status")
        .in("stock_status", ["low_stock", "out_of_stock"])
        .eq("is_warehouse", false)
        .order("quantity"),
      // Active shortage forecasts
      supabase
        .from("forecast_vs_inventory_view")
        .select("device_id, device_name, store_id, store_name, predicted_quantity, current_stock, stock_gap, risk_level, forecast_period")
        .in("risk_level", ["shortage_expected", "at_risk"])
        .order("stock_gap")
        .limit(30),
      // Top selling this month for context
      supabase
        .from("monthly_sales_view")
        .select("device_id, device_name, store_id, store_name, total_units_sold")
        .gte("sale_month", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
        .order("total_units_sold", { ascending: false })
        .limit(20),
      // All stores + warehouse info
      supabase.from("stores").select("id, name, is_warehouse").eq("status", "active"),
    ]);

    const warehouseStore = stores?.find(s => s.is_warehouse);

    // Build context for the AI — include real UUIDs so AI uses them directly
    const lowStockLines = (lowStock ?? []).map(r =>
      `device_id="${r.device_id}" store_id="${r.store_id}" | ${r.brand} ${r.device_name} (SKU: ${r.sku}) @ ${r.store_name}: ${r.quantity} units (threshold: ${r.low_stock_threshold}, status: ${r.stock_status})`
    ).join("\n");

    const forecastLines = (forecasts ?? []).map(r =>
      `device_id="${r.device_id}" store_id="${r.store_id}" | ${r.device_name} @ ${r.store_name ?? "Global"}: predicted demand ${r.predicted_quantity}, current stock ${r.current_stock}, gap ${r.stock_gap} — ${r.risk_level}`
    ).join("\n");

    const topSellingLines = (topSelling ?? []).map(r =>
      `device_id="${r.device_id}" store_id="${r.store_id}" | ${r.device_name} @ ${r.store_name}: ${r.total_units_sold} units sold this month`
    ).join("\n");

    const systemPrompt = `You are an inventory management AI for Channels by stc in Bahrain.
Analyze the stock levels, forecasts, and sales velocity data provided.
Generate restock transfer suggestions from the warehouse to retail stores.
Respond ONLY with a valid JSON array. No markdown, no explanation.

Each item in the array must have these exact fields:
{
  "deviceId": "uuid string from the data",
  "deviceName": "string",
  "brand": "string",
  "sku": "string",
  "storeId": "uuid of the destination retail store",
  "storeName": "string",
  "currentStock": number,
  "predictedDemand": number (use forecast if available, else estimate from sales velocity),
  "suggestedQty": number (how many units to transfer — be specific and realistic),
  "urgency": "critical" | "high" | "medium",
  "reason": "one sentence explaining why (mention stock level, sales trend, or forecast)"
}

Rules:
- "critical" = out of stock or will run out in < 3 days based on sales velocity
- "high" = below threshold or shortage forecast
- "medium" = at risk or trending toward low stock
- Only suggest realistic quantities (don't suggest more than 50 units unless critical)
- Sort by urgency: critical first, then high, then medium
- Maximum 15 suggestions`;

    const userMessage = `Current Low/Out of Stock Items:\n${lowStockLines || "None"}\n\nForecast Warnings:\n${forecastLines || "None"}\n\nTop Selling This Month:\n${topSellingLines || "None"}\n\nWarehouse store ID: ${warehouseStore?.id ?? "unknown"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let suggestions: RestockSuggestion[] = [];

    try {
      const parsed = JSON.parse(raw);
      // AI may return { suggestions: [...] } or just [...]
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? parsed.items ?? []);
    } catch {
      suggestions = [];
    }

    // Validate AI output — filter out any suggestions with fake/hallucinated IDs
    const validDeviceIds = new Set([
      ...(lowStock ?? []).map(r => r.device_id as string),
      ...(forecasts ?? []).map(r => r.device_id as string),
      ...(topSelling ?? []).map(r => r.device_id as string),
    ]);
    const validStoreIds = new Set((stores ?? []).map(s => s.id as string));
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    suggestions = suggestions.filter(s =>
      uuidRegex.test(s.deviceId) &&
      uuidRegex.test(s.storeId) &&
      validDeviceIds.has(s.deviceId) &&
      validStoreIds.has(s.storeId)
    );

    // Attach warehouseStoreId to each suggestion
    const warehouseId = warehouseStore?.id ?? "";
    suggestions = suggestions.map(s => ({ ...s, warehouseStoreId: warehouseId }));

    return NextResponse.json({ suggestions, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[restock route]", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
