// AI Restock Suggestions API — admin + warehouse manager only
// Fetches low-stock items, forecast warnings, and sales velocity,
// then calls GPT-4o-mini to generate restock transfer suggestions.
// Post-processes AI output to strip any hallucinated IDs.
import { NextResponse } from "next/server";
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

type LowStockRow = {
  device_id: string;
  device_name: string;
  brand: string;
  sku: string;
  store_id: string;
  store_name: string;
  quantity: number;
  low_stock_threshold: number;
  stock_status: string;
};

type ForecastRow = {
  device_id: string;
  device_name: string;
  store_id: string | null;
  store_name: string | null;
  predicted_quantity: number;
  current_stock: number;
  stock_gap: number;
  risk_level: string;
};

type TopSellingRow = {
  device_id: string;
  store_id: string;
  total_units_sold: number;
};

function urgencyRank(urgency: RestockSuggestion["urgency"]) {
  return urgency === "critical" ? 0 : urgency === "high" ? 1 : 2;
}

function buildFallbackSuggestions(params: {
  lowStock: LowStockRow[];
  forecasts: ForecastRow[];
  topSelling: TopSellingRow[];
  warehouseStock: Map<string, number>;
  warehouseStoreId: string;
}) {
  const forecastByTarget = new Map(
    params.forecasts
      .filter((forecast) => forecast.store_id)
      .map((forecast) => [`${forecast.device_id}-${forecast.store_id}`, forecast])
  );
  const monthlySalesByTarget = new Map(
    params.topSelling.map((row) => [`${row.device_id}-${row.store_id}`, Number(row.total_units_sold)])
  );

  const suggestions = new Map<string, RestockSuggestion>();

  for (const row of params.lowStock) {
    const availableAtWarehouse = params.warehouseStock.get(row.device_id) ?? 0;
    if (availableAtWarehouse <= 0) continue;

    const key = `${row.device_id}-${row.store_id}`;
    const forecast = forecastByTarget.get(key);
    const monthlySales = monthlySalesByTarget.get(key) ?? 0;
    const predictedDemand = Math.max(
      Number(forecast?.predicted_quantity ?? 0),
      Number(row.low_stock_threshold ?? 0),
      monthlySales > 0 ? Math.ceil(monthlySales / 2) : 0,
      Number(row.quantity ?? 0) + 1
    );
    const shortage = Math.max(predictedDemand - Number(row.quantity), Number(row.low_stock_threshold) - Number(row.quantity), 1);
    const urgency: RestockSuggestion["urgency"] =
      row.stock_status === "out_of_stock" || Number(row.quantity) === 0
        ? "critical"
        : forecast?.risk_level === "shortage_expected"
          ? "critical"
          : forecast?.risk_level === "at_risk" || Number(row.quantity) <= Number(row.low_stock_threshold)
            ? "high"
            : "medium";
    const suggestedQty = Math.min(Math.max(Math.ceil(shortage), 1), availableAtWarehouse, urgency === "critical" ? 50 : 20);

    if (suggestedQty <= 0) continue;

    suggestions.set(key, {
      deviceId: row.device_id,
      deviceName: row.device_name,
      brand: row.brand,
      sku: row.sku,
      storeId: row.store_id,
      storeName: row.store_name,
      currentStock: Number(row.quantity),
      predictedDemand,
      suggestedQty,
      urgency,
      reason:
        row.stock_status === "out_of_stock"
          ? `Out of stock at ${row.store_name}.`
          : forecast
            ? `${forecast.risk_level === "shortage_expected" ? "Shortage forecast" : "At-risk forecast"} and current stock is below threshold at ${row.store_name}.`
            : `Low stock at ${row.store_name}, below threshold.`,
      warehouseStoreId: params.warehouseStoreId,
    });
  }

  return Array.from(suggestions.values())
    .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.currentStock - b.currentStock)
    .slice(0, 15);
}

export async function GET() {
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
      { data: warehouseInventory },
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
      // Warehouse availability guardrail
      supabase
        .from("current_inventory_view")
        .select("device_id, quantity")
        .eq("is_warehouse", true),
    ]);

    const warehouseStore = stores?.find(s => s.is_warehouse);
    const warehouseId = warehouseStore?.id ?? "";
    const warehouseStock = new Map(
      (warehouseInventory ?? []).map((row) => [row.device_id as string, row.quantity as number])
    );
    const fallbackSuggestions = buildFallbackSuggestions({
      lowStock: (lowStock ?? []) as LowStockRow[],
      forecasts: (forecasts ?? []) as ForecastRow[],
      topSelling: (topSelling ?? []) as TopSellingRow[],
      warehouseStock,
      warehouseStoreId: warehouseId,
    });

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

    let suggestions: RestockSuggestion[] = [];
    let source: "ai" | "database" = "ai";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      // AI may return { suggestions: [...] } or just [...]
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? parsed.items ?? []);
    } catch (error) {
      console.warn("[restock route] AI suggestion generation failed, using deterministic fallback:", error);
      suggestions = [];
    }

    // Validate AI output — filter out any suggestions with fake/hallucinated IDs
    const validDeviceIds = new Set([
      ...(lowStock ?? []).map(r => r.device_id as string),
      ...(forecasts ?? []).map(r => r.device_id as string),
      ...(topSelling ?? []).map(r => r.device_id as string),
    ]);
    const storeById = new Map((stores ?? []).map(s => [s.id as string, s]));
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    suggestions = suggestions.filter((s) => {
      const destinationStore = storeById.get(s.storeId);
      const availableAtWarehouse = warehouseStock.get(s.deviceId) ?? 0;

      return uuidRegex.test(s.deviceId) &&
        uuidRegex.test(s.storeId) &&
        validDeviceIds.has(s.deviceId) &&
        Boolean(destinationStore) &&
        destinationStore?.is_warehouse === false &&
        Number.isInteger(s.suggestedQty) &&
        s.suggestedQty > 0 &&
        s.suggestedQty <= availableAtWarehouse;
    });

    // Attach warehouseStoreId to each suggestion and keep one suggestion per
    // destination store/device pair so the UI does not show duplicate transfer cards.
    const suggestionByTarget = new Map<string, RestockSuggestion>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.deviceId}-${suggestion.storeId}`;
      const normalized = { ...suggestion, warehouseStoreId: warehouseId };
      const existing = suggestionByTarget.get(key);

      if (!existing || normalized.suggestedQty > existing.suggestedQty) {
        suggestionByTarget.set(key, normalized);
      }
    }

    suggestions = Array.from(suggestionByTarget.values());

    if (suggestions.length === 0 && fallbackSuggestions.length > 0) {
      suggestions = fallbackSuggestions;
      source = "database";
    }

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
      source,
    });
  } catch (err) {
    console.error("[restock route]", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
