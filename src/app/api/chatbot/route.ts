// File purpose: Handles chatbot requests by building role-scoped context, calling OpenAI, and logging the interaction.
// AI Chatbot API route. Builds role-aware database context, asks OpenAI for a
// grounded answer, and logs each interaction for traceability.
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/openai/prompts";
import OpenAI from "openai";
import type { UserRole } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The route uses a simple intent value to decide what data should be loaded.
// This keeps the chatbot faster because it does not need every table for every question.
type ChatIntent =
  | "warehouse_availability"
  | "sales_revenue"
  | "inventory"
  | "alerts"
  | "transfers"
  | "forecasts"
  | "devices"
  | "general";

type StoreRecord = {
  id: string;
  name: string;
  code: string | null;
  is_warehouse: boolean;
};

type DeviceRecord = {
  id: string;
  name: string;
  brand: string;
  sku: string;
  status: string;
  unit_price: number;
  low_stock_threshold: number;
};

// Normalize user questions and database names into a simple searchable format.
// Example: "City Centre" and "city center" become comparable.
// Handles a backend API request, checks access, and returns JSON to the frontend.
function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bcentre\b/g, "center")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Detect the main topic of the question.
// The detected intent is also stored in chatbot_logs for traceability.
// Handles a backend API request, checks access, and returns JSON to the frontend.
function detectIntent(question: string): ChatIntent {
  const text = normalizeText(question);

  if (/\bwarehouse\b|\bavailable\b|\bavailability\b|\bin stock\b|\bstock in warehouse\b/.test(text)) {
    return "warehouse_availability";
  }
  if (/\brevenue\b|\bsales\b|\bsold\b|\bincome\b|\bearning\b|\bprofit\b|\bamount\b/.test(text)) {
    return "sales_revenue";
  }
  if (/\blow stock\b|\bout of stock\b|\bstock\b|\binventory\b|\bquantity\b|\bavailable units\b/.test(text)) {
    return "inventory";
  }
  if (/\balert\b|\bwarning\b|\bcritical\b|\bresolved\b|\backnowledged\b/.test(text)) {
    return "alerts";
  }
  if (/\btransfer\b|\brequest\b|\bin transit\b|\bapproved\b|\brejected\b|\bcompleted\b/.test(text)) {
    return "transfers";
  }
  if (/\bforecast\b|\bdemand\b|\bpredict\b|\bprediction\b|\brisk\b|\bshortage\b/.test(text)) {
    return "forecasts";
  }
  if (/\bdevice\b|\bsku\b|\bprice\b|\bcategory\b|\bcatalogue\b|\bcatalog\b/.test(text)) {
    return "devices";
  }

  return "general";
}

// Decide whether a general message is still related to this system.
// If it is not related, the route returns a fixed out-of-scope answer
// instead of sending the message to OpenAI.
function isRelevantQuestion(question: string, intent: ChatIntent) {
  if (intent !== "general") return true;

  const text = normalizeText(question);
  return /\bhelp\b|\bwhat can you do\b|\bwho are you\b|\bhow do you work\b|\bdashboard\b|\bsystem\b|\binventory\b|\bstock\b|\bsales\b|\btransfer\b|\bforecast\b|\balert\b|\bdevice\b|\bstore\b|\bwarehouse\b|\breport\b|\brestock\b|\bchatbot\b/.test(text);
}

// Try to find whether the user mentioned a store by name, code, or warehouse keyword.
// This helps the route scope answers to a specific branch when the question names one.
// Handles a backend API request, checks access, and returns JSON to the frontend.
function findMentionedStore(question: string, stores: StoreRecord[]) {
  const text = normalizeText(question);
  if (/\bwarehouse\b|\bcentral warehouse\b|\bhidd\b/.test(text)) {
    return stores.find((store) => store.is_warehouse) ?? null;
  }

  return stores.find((store) => {
    const name = normalizeText(store.name);
    const code = normalizeText(store.code ?? "");
    const meaningfulNameParts = name.split(" ").filter((part) => part.length > 2);

    return text.includes(name) ||
      (code.length > 0 && text.includes(code)) ||
      meaningfulNameParts.every((part) => text.includes(part));
  }) ?? null;
}

// Try to match the user's question to a known device.
// The route uses this for direct answers such as warehouse availability.
// Handles a backend API request, checks access, and returns JSON to the frontend.
function findMentionedDevice(question: string, devices: DeviceRecord[]) {
  const text = normalizeText(question);

  return devices.find((device) => {
    const name = normalizeText(`${device.brand} ${device.name}`);
    const shortName = normalizeText(device.name);
    const sku = normalizeText(device.sku);
    const meaningfulNameParts = shortName.split(" ").filter((part) => part.length > 2);

    return text.includes(name) ||
      text.includes(shortName) ||
      text.includes(sku) ||
      meaningfulNameParts.every((part) => text.includes(part));
  }) ?? null;
}

// Format money consistently in Bahraini Dinar.
// Handles a backend API request, checks access, and returns JSON to the frontend.
function currency(value: number) {
  return `BD ${value.toFixed(3)}`;
}

// Store every chatbot request in the database.
// This supports auditability, evaluation, and troubleshooting.
// Handles a backend API request, checks access, and returns JSON to the frontend.
async function writeChatbotLog(params: {
  userId: string;
  role: UserRole;
  storeId: string | null;
  question: string;
  answer: string;
  status: "success" | "error";
  startedAt: number;
  interpretedIntent?: string;
  queryContext?: Record<string, unknown>;
  errorMessage?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("chatbot_logs").insert({
      user_id: params.userId,
      user_role: params.role,
      store_id: params.storeId,
      question: params.question,
      interpreted_intent: params.interpretedIntent ?? null,
      query_context: params.queryContext ?? null,
      answer: params.answer,
      status: params.status,
      error_message: params.errorMessage ?? null,
      prompt_tokens: params.promptTokens ?? null,
      completion_tokens: params.completionTokens ?? null,
      response_time_ms: Date.now() - params.startedAt,
    });
  } catch (error) {
    console.error("[chatbot route] Failed to write chatbot log:", error);
  }
}

// Handles a backend API request, checks access, and returns JSON to the frontend.
export async function POST(req: NextRequest) {
  // Start time is used to calculate response_time_ms in chatbot_logs.
  const startedAt = Date.now();

  // These variables are kept outside the try block so errors can still be logged.
  let logUserId: string | undefined;
  let logRole: UserRole | undefined;
  let logStoreId: string | null = null;
  let logQuestion = "";
  let logIntent: ChatIntent = "general";
  let logQueryContext: Record<string, unknown> = {};

  try {
    // User client respects the logged-in user's session.
    // Service role client is used only in this trusted backend route to build context.
    const userSupabase = await createServerSupabaseClient();
    const serviceSupabase = await createServiceRoleClient();

    // Step 1: confirm the user is logged in.
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Step 2: read the message sent from the chatbot UI.
    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    logUserId = user.id;
    logQuestion = message;
    logIntent = detectIntent(message);

    // Step 3: load the user's business profile.
    // The role and store_id decide what the chatbot is allowed to answer.
    const { data: profile } = await userSupabase
      .from("profiles")
      .select("role, store_id, full_name, stores(name)")
      .eq("id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const role = profile.role as UserRole;
    const storeId = profile.store_id as string | null;
    const assignedStoreName = (profile.stores as unknown as { name: string } | null)?.name ?? null;
    const isStoreManager = role === "store_manager";

    logRole = role;
    logStoreId = storeId;

    if (!isRelevantQuestion(message, logIntent)) {
      const answer = "That question is outside my scope. I can help with inventory, stock levels, sales, transfers, alerts, forecasts, devices, stores, reports, and restock planning.";

      await writeChatbotLog({
        userId: user.id,
        role,
        storeId,
        question: message,
        answer,
        status: "success",
        startedAt,
        interpretedIntent: "general",
        queryContext: { rejectedAsOutOfScope: true },
        promptTokens: 0,
        completionTokens: 0,
      });

      return NextResponse.json({ answer });
    }

    // Step 4: load master data needed for matching store names and device names.
    // These are small lists and help the route understand the user's question.
    const [
      { data: stores },
      { data: devices },
    ] = await Promise.all([
      serviceSupabase
        .from("stores")
        .select("id, name, code, is_warehouse")
        .eq("status", "active")
        .order("name"),
      serviceSupabase
        .from("devices")
        .select("id, name, brand, sku, status, unit_price, low_stock_threshold")
        .order("brand")
        .order("name"),
    ]);

    const activeStores = (stores ?? []) as StoreRecord[];
    const activeDevices = ((devices ?? []) as DeviceRecord[]).filter((device) => device.status === "active");
    const warehouseStore = activeStores.find((store) => store.is_warehouse) ?? null;
    const mentionedStore = findMentionedStore(message, activeStores);
    const mentionedDevice = findMentionedDevice(message, activeDevices);

    // Store Managers must not see other retail branches.
    // If they ask about another branch, return a clear permission-safe answer.
    const questionNamesAnotherRetailStore = Boolean(
      isStoreManager &&
      mentionedStore &&
      !mentionedStore.is_warehouse &&
      storeId &&
      mentionedStore.id !== storeId
    );

    if (questionNamesAnotherRetailStore) {
      const answer = `I can only access operational data for ${assignedStoreName ?? "your assigned store"}. I cannot provide ${mentionedStore?.name} sales, revenue, alerts, forecasts, or branch inventory details. I can still check central warehouse availability for a device if you are planning a transfer.`;

      await writeChatbotLog({
        userId: user.id,
        role,
        storeId,
        question: message,
        answer,
        status: "success",
        startedAt,
        interpretedIntent: logIntent,
        queryContext: {
          blocked: true,
          reason: "store_manager_requested_other_retail_store",
          requestedStore: mentionedStore?.name,
          assignedStore: assignedStoreName,
        },
      });

      return NextResponse.json({ answer });
    }

    // Decide the effective data scope for the answer.
    // Store Manager: assigned store only.
    // Admin/Warehouse: mentioned branch if provided, otherwise full system.
    const effectiveStoreId = isStoreManager
      ? storeId
      : mentionedStore && !mentionedStore.is_warehouse
        ? mentionedStore.id
        : null;
    const effectiveStoreName = isStoreManager
      ? assignedStoreName
      : mentionedStore && !mentionedStore.is_warehouse
        ? mentionedStore.name
        : null;

    const contextParts: string[] = [];
    const directHints: string[] = [];

    // This object is saved in chatbot_logs so we know what scope was used.
    logQueryContext = {
      intent: logIntent,
      role,
      assignedStore: assignedStoreName,
      requestedStore: mentionedStore?.name ?? null,
      requestedDevice: mentionedDevice ? `${mentionedDevice.brand} ${mentionedDevice.name}` : null,
      scope: isStoreManager ? "assigned_store_plus_warehouse_availability" : "full_operational_access",
    };

    // Add active device catalogue only when it is useful.
    // This gives the AI device names, SKUs, prices, and thresholds.
    // Device catalogue is useful for general, device, and SKU questions.
    if (logIntent === "devices" || logIntent === "general") {
      const catalogueLines = activeDevices.slice(0, 60).map(
        (device) => `  - ${device.brand} ${device.name} (${device.sku}): ${currency(Number(device.unit_price))}, min stock ${device.low_stock_threshold}`
      );
      contextParts.push(`## Device Catalogue (${activeDevices.length} active)\n${catalogueLines.join("\n")}`);
    } else if (mentionedDevice) {
      contextParts.push(
        `## Matched Device\n  - ${mentionedDevice.brand} ${mentionedDevice.name} (${mentionedDevice.sku}), min stock ${mentionedDevice.low_stock_threshold}`
      );
    }

    const needsInventory = ["inventory", "warehouse_availability", "general"].includes(logIntent);
    if (needsInventory) {
      // Read inventory from the database view.
      // The view already joins devices, stores, categories, and stock status.
      let inventoryQuery = serviceSupabase
        .from("current_inventory_view")
        .select("device_id, device_name, brand, sku, store_id, store_name, quantity, low_stock_threshold, stock_status, is_warehouse")
        .order("store_name")
        .order("device_name");

      // Store Managers see their assigned store and warehouse stock only.
      // Admin/Warehouse can narrow by the store mentioned in the question.
      if (isStoreManager && storeId) {
        inventoryQuery = inventoryQuery.or(`store_id.eq.${storeId},is_warehouse.eq.true`);
      } else if (mentionedStore) {
        inventoryQuery = inventoryQuery.eq("store_id", mentionedStore.id);
      }
      if (mentionedDevice) inventoryQuery = inventoryQuery.eq("device_id", mentionedDevice.id);

      const { data: inventory } = await inventoryQuery;
      const inventoryRows = inventory ?? [];

      if (inventoryRows.length > 0) {
        // Group inventory rows by store so the chatbot answer is easier to read.
        const byStore: Record<string, typeof inventoryRows> = {};
        for (const row of inventoryRows) {
          const key = `${row.store_name}${row.is_warehouse ? " (Warehouse)" : ""}`;
          (byStore[key] ??= []).push(row);
        }

        const storeBlocks = Object.entries(byStore).map(([store, rows]) => {
          const lowRows = rows.filter((row) => row.stock_status !== "in_stock");
          const rowsToShow = logIntent === "inventory" && !mentionedDevice
            ? (lowRows.length > 0 ? lowRows : rows).slice(0, 20)
            : rows.slice(0, 20);
          const items = rowsToShow.map(
            (row) => `    - ${row.brand} ${row.device_name} (${row.sku}): ${row.quantity} units [${row.stock_status}], threshold ${row.low_stock_threshold}`
          );
          return `  ${store}:\n${items.join("\n")}`;
        });

        contextParts.push(`## Inventory Context\n${storeBlocks.join("\n")}`);

        // If the question asks about warehouse availability, add a direct hint.
        // This helps the model answer clearly instead of only reading raw rows.
        if (logIntent === "warehouse_availability" && warehouseStore) {
          const warehouseRows = inventoryRows.filter((row) => row.is_warehouse);
          if (warehouseRows.length > 0) {
            directHints.push(
              `Warehouse availability: ${warehouseRows.map((row) => `${row.brand} ${row.device_name} has ${row.quantity} units`).join("; ")}.`
            );
          }
        }
      } else {
        contextParts.push("## Inventory Context\n  No matching inventory records were found.");
      }
    }

    const needsSales = ["sales_revenue", "general"].includes(logIntent);
    if (needsSales) {
      // Monthly sales view is used for revenue and sales questions.
      // It gives aggregated data instead of loading every sale row.
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const fromDate = twelveMonthsAgo.toISOString().split("T")[0];

      let salesQuery = serviceSupabase
        .from("monthly_sales_view")
        .select("sale_month, device_id, device_name, brand, store_id, store_name, total_units_sold, total_revenue")
        .gte("sale_month", fromDate)
        .order("sale_month", { ascending: false })
        .order("total_units_sold", { ascending: false });

      if (effectiveStoreId) salesQuery = salesQuery.eq("store_id", effectiveStoreId);
      if (mentionedDevice) salesQuery = salesQuery.eq("device_id", mentionedDevice.id);

      const { data: salesHistory } = await salesQuery;
      const rows = salesHistory ?? [];

      if (rows.length > 0) {
        // Calculate total units and revenue before sending context to OpenAI.
        // This makes the final answer more accurate.
        const totalUnits = rows.reduce((sum, row) => sum + Number(row.total_units_sold), 0);
        const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total_revenue), 0);
        const salesScope = effectiveStoreName ? ` for ${effectiveStoreName}` : "";

        directHints.push(
          `Computed revenue${salesScope} from available monthly sales records: ${currency(totalRevenue)} from ${totalUnits} units sold.`
        );

        // Group sales by month for trend questions.
        const byMonth: Record<string, { units: number; revenue: number }> = {};
        for (const row of rows) {
          const month = String(row.sale_month).slice(0, 7);
          if (!byMonth[month]) byMonth[month] = { units: 0, revenue: 0 };
          byMonth[month].units += Number(row.total_units_sold);
          byMonth[month].revenue += Number(row.total_revenue);
        }

        const monthLines = Object.entries(byMonth)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 6)
          .map(([month, value]) => `  - ${month}: ${value.units} units, ${currency(value.revenue)}`);

        // Group sales by device so the chatbot can mention top sellers.
        const byDevice: Record<string, { units: number; revenue: number }> = {};
        for (const row of rows) {
          const key = `${row.brand} ${row.device_name}`;
          if (!byDevice[key]) byDevice[key] = { units: 0, revenue: 0 };
          byDevice[key].units += Number(row.total_units_sold);
          byDevice[key].revenue += Number(row.total_revenue);
        }

        const topDeviceLines = Object.entries(byDevice)
          .sort((a, b) => b[1].units - a[1].units)
          .slice(0, 10)
          .map(([name, value]) => `  - ${name}: ${value.units} units, ${currency(value.revenue)}`);

        contextParts.push(
          `## Sales and Revenue Context${salesScope}\nTotal units: ${totalUnits}\nTotal revenue: ${currency(totalRevenue)}\nRecent months:\n${monthLines.join("\n")}\nTop devices:\n${topDeviceLines.join("\n")}`
        );
      } else {
        contextParts.push("## Sales and Revenue Context\n  No matching sales records were found for the requested scope.");
      }
    }

    const needsAlerts = ["alerts", "general"].includes(logIntent);
    if (needsAlerts) {
      // Alerts explain current operational problems such as low stock.
      let alertQuery = serviceSupabase
        .from("alerts")
        .select("alert_type, message, severity, store_id, stores(name)")
        .eq("status", "active")
        .order("severity");

      if (effectiveStoreId) alertQuery = alertQuery.eq("store_id", effectiveStoreId);
      const { data: alerts } = await alertQuery;
      const alertRows = alerts ?? [];

      if (alertRows.length > 0) {
        const lines = alertRows.slice(0, 25).map(
          (alert) => `  - [${String(alert.severity).toUpperCase()}] ${(alert.stores as unknown as { name: string } | null)?.name ?? "System"}: ${alert.message}`
        );
        contextParts.push(`## Active Alerts (${alertRows.length})\n${lines.join("\n")}`);
      } else {
        contextParts.push("## Active Alerts\n  None for the requested scope.");
      }
    }

    const needsTransfers = ["transfers", "general"].includes(logIntent);
    if (needsTransfers) {
      // Transfers show movement requests between warehouse and branches.
      let transferQuery = serviceSupabase
        .from("transfers")
        .select("status, notes, transfer_date, created_at, source_store_id, destination_store_id, from_store:source_store_id(name), to_store:destination_store_id(name), transfer_items(quantity, devices(name, brand))")
        .order("created_at", { ascending: false })
        .limit(30);

      if (isStoreManager && storeId) {
        transferQuery = transferQuery.or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`);
      } else if (mentionedStore) {
        transferQuery = transferQuery.or(`source_store_id.eq.${mentionedStore.id},destination_store_id.eq.${mentionedStore.id}`);
      }

      const { data: transfers } = await transferQuery;
      const transferRows = transfers ?? [];

      if (transferRows.length > 0) {
        const byStatus: Record<string, number> = {};
        for (const transfer of transferRows) byStatus[transfer.status] = (byStatus[transfer.status] ?? 0) + 1;
        const statusSummary = Object.entries(byStatus).map(([status, count]) => `${count} ${status}`).join(", ");
        const lines = transferRows.slice(0, 15).map((transfer) => {
          const items = (transfer.transfer_items as unknown as { quantity: number; devices: { name: string; brand: string } | null }[])
            ?.map((item) => `${item.quantity}x ${item.devices?.brand} ${item.devices?.name}`)
            .join(", ") ?? "";
          return `  - [${String(transfer.status).toUpperCase()}] ${(transfer.from_store as unknown as { name: string } | null)?.name ?? "?"} -> ${(transfer.to_store as unknown as { name: string } | null)?.name ?? "?"}: ${items}`;
        });
        contextParts.push(`## Recent Transfers (${statusSummary})\n${lines.join("\n")}`);
      } else {
        contextParts.push("## Recent Transfers\n  No matching transfer records were found.");
      }
    }

    const needsForecasts = ["forecasts", "general"].includes(logIntent);
    if (needsForecasts) {
      // Forecast view compares predicted demand with current stock.
      // This is used for demand-risk answers.
      let forecastQuery = serviceSupabase
        .from("forecast_vs_inventory_view")
        .select("device_id, predicted_quantity, current_stock, stock_gap, risk_level, forecast_period, device_name, store_id, store_name")
        .order("forecast_period", { ascending: false })
        .limit(40);

      if (isStoreManager && storeId) {
        forecastQuery = forecastQuery.or(`store_id.eq.${storeId},store_id.is.null`);
      } else if (mentionedStore && !mentionedStore.is_warehouse) {
        forecastQuery = forecastQuery.eq("store_id", mentionedStore.id);
      }
      if (mentionedDevice) forecastQuery = forecastQuery.eq("device_id", mentionedDevice.id);

      const { data: forecasts } = await forecastQuery;
      const forecastRows = forecasts ?? [];

      if (forecastRows.length > 0) {
        const critical = forecastRows.filter((forecast) => forecast.risk_level === "shortage_expected");
        const atRisk = forecastRows.filter((forecast) => forecast.risk_level === "at_risk");
        const lines = [...critical, ...atRisk, ...forecastRows.filter((forecast) => forecast.risk_level === "sufficient")]
          .slice(0, 20)
          .map((forecast) => `  - ${forecast.device_name} @ ${forecast.store_name ?? "Global"}: predicted ${forecast.predicted_quantity}, current ${forecast.current_stock}, gap ${forecast.stock_gap} [${forecast.risk_level}]`);
        contextParts.push(
          `## Demand Forecasts\nCritical shortages: ${critical.length}, At risk: ${atRisk.length}\n${lines.join("\n")}`
        );
      } else {
        contextParts.push("## Demand Forecasts\n  No matching forecast records were found.");
      }
    }

    if (directHints.length > 0) {
      // Put calculated hints at the top of the prompt context.
      // The model should use these first because they are already computed.
      contextParts.unshift(`## Computed Answer Hints\n${directHints.map((hint) => `  - ${hint}`).join("\n")}`);
    }

    // Build the final OpenAI system prompt and role access guardrail.
    const today = new Date().toISOString().split("T")[0];
    const accessScope = isStoreManager
      ? `\n\n## Access Scope Guardrail\nThe user is assigned to ${assignedStoreName ?? "their store"}.\n- Sales, revenue, alerts, transfers, and forecasts are scoped to that assigned store.\n- Warehouse inventory rows are included only for availability and transfer planning.\n- Do not provide other retail branch sales, revenue, alerts, forecasts, or inventory details.\n- If another branch is requested, explain the role limitation.`
      : "\n\n## Access Scope Guardrail\nThe user has full operational visibility. Answer across all stores and the warehouse when the question is broad, and narrow to a named store or device when requested.";
    const systemPrompt = `${buildSystemPrompt(role, assignedStoreName ?? undefined, today)}${accessScope}`;
    const contextBlock = contextParts.join("\n\n");

    logQueryContext = {
      ...logQueryContext,
      contextSections: contextParts.length,
      directHints,
    };

    // Final message list sent to OpenAI:
    // 1. system prompt + database context
    // 2. short chat history
    // 3. latest user question
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: `${systemPrompt}\n\n${contextBlock}` },
      ...(history as unknown as { role: "user" | "assistant"; content: string }[])
        .slice(-8)
        .map((historyMessage) => ({ role: historyMessage.role, content: historyMessage.content })),
      { role: "user", content: message },
    ];

    // Ask OpenAI for the final answer.
    // Low temperature keeps answers more stable and less creative.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 900,
      temperature: 0.1,
    });

    const answer = completion.choices[0]?.message?.content ?? "Sorry, I could not generate a response.";

    // Save successful chatbot interaction for traceability.
    await writeChatbotLog({
      userId: user.id,
      role,
      storeId,
      question: message,
      answer,
      status: "success",
      startedAt,
      interpretedIntent: logIntent,
      queryContext: logQueryContext,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
    });

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    console.error("[chatbot route]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";

    // If an error happens after user/profile/message are known, log it too.
    // This helps explain failed chatbot requests during testing.
    if (logUserId && logRole && logQuestion) {
      await writeChatbotLog({
        userId: logUserId,
        role: logRole,
        storeId: logStoreId,
        question: logQuestion,
        answer: "",
        status: "error",
        startedAt,
        interpretedIntent: logIntent,
        queryContext: logQueryContext,
        errorMessage: message,
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
