// File purpose: Prepares and sends protected monthly summary reports for administrators.
// Monthly report cron job — triggered by Vercel Cron on the 1st of each month
// Fetches last month's sales, top devices, and stock health, then emails
// a formatted HTML report to all active admin accounts via Resend.
// Protected by CRON_SECRET env variable.
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildMonthlyReportHtml } from "@/lib/email/monthly-report-template";
import { CURRENCY_SYMBOL } from "@/constants";

const resend = new Resend(process.env.RESEND_API_KEY);

// Handles a backend API request, checks access, and returns JSON to the frontend.
function formatBhd(amount: number) {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString("en-BH", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

// Handles a backend API request, checks access, and returns JSON to the frontend.
async function logMonthlyReportFailure(errorMessage: string, details?: Record<string, unknown>) {
  try {
    const supabase = await createServiceRoleClient();
    await supabase.from("automation_logs").insert({
      automation_type: "monthly_email_report",
      status: "error",
      records_processed: 0,
      records_created: 0,
      details: details ?? {},
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });
  } catch (logError) {
    console.error("[monthly-report] Failed to write failure log:", logError);
  }
}

// Handles a backend API request, checks access, and returns JSON to the frontend.
export async function GET(req: NextRequest) {
  // Verify cron secret — Vercel sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceRoleClient();

    const now = new Date();
    // Report for previous month
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfLastMonth = reportDate.toISOString().split("T")[0];
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    const monthLabel = reportDate.toLocaleDateString("en-BH", { month: "long", year: "numeric" });

    // Fetch all data in parallel
    const [
      { data: salesData },
      { data: salesRecords },
      { count: lowStockCount },
      { count: outOfStockCount },
      { count: activeAlerts },
      { count: pendingTransfers },
      { data: adminProfiles },
    ] = await Promise.all([
      supabase
        .from("monthly_sales_view")
        .select("store_id, store_name, device_id, device_name, total_units_sold, total_revenue, sale_month")
        .gte("sale_month", startOfLastMonth)
        .lte("sale_month", endOfLastMonth),
      supabase
        .from("sales")
        .select("id, store_id, stores(name)")
        .gte("sale_date", startOfLastMonth)
        .lte("sale_date", endOfLastMonth),
      supabase
        .from("current_inventory_view")
        .select("inventory_id", { count: "exact", head: true })
        .eq("stock_status", "low_stock"),
      supabase
        .from("current_inventory_view")
        .select("inventory_id", { count: "exact", head: true })
        .eq("stock_status", "out_of_stock"),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("role", "admin")
        .eq("status", "active"),
    ]);

    if (!adminProfiles || adminProfiles.length === 0) {
      return NextResponse.json({ error: "No admin emails found" }, { status: 404 });
    }

    // Aggregate totals
    const totalRevenue = (salesData ?? []).reduce((s, r) => s + Number(r.total_revenue), 0);
    const totalUnits = (salesData ?? []).reduce((s, r) => s + (r.total_units_sold as number), 0);

    const totalSales = salesRecords?.length ?? 0;

    // Top devices for the reported month
    const topDeviceMap: Record<string, { name: string; units: number; revenue: number }> = {};
    for (const row of salesData ?? []) {
      const id = row.device_id as string;
      topDeviceMap[id] = {
        name: row.device_name as string,
        units: (topDeviceMap[id]?.units ?? 0) + (row.total_units_sold as number),
        revenue: (topDeviceMap[id]?.revenue ?? 0) + Number(row.total_revenue),
      };
    }
    const topDevices = Object.values(topDeviceMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((device) => ({
        name: device.name,
        units: device.units,
        revenue: formatBhd(device.revenue),
      }));

    // Store breakdown from salesData
    const storeSaleCounts: Record<string, number> = {};
    for (const sale of salesRecords ?? []) {
      const storeName = (sale.stores as unknown as { name: string } | null)?.name ?? "Unknown Store";
      storeSaleCounts[storeName] = (storeSaleCounts[storeName] ?? 0) + 1;
    }

    const storeMap: Record<string, { revenue: number; sales: number }> = {};
    for (const row of salesData ?? []) {
      const name = row.store_name as string;
      storeMap[name] = {
        revenue: (storeMap[name]?.revenue ?? 0) + Number(row.total_revenue),
        sales: storeSaleCounts[name] ?? 0,
      };
    }
    const storeBreakdown = Object.entries(storeMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([name, { revenue, sales }]) => ({
        name,
        revenue: formatBhd(revenue),
        sales,
      }));

    const html = buildMonthlyReportHtml({
      month: monthLabel,
      totalRevenue: formatBhd(totalRevenue),
      totalSales,
      totalUnits,
      lowStockCount: lowStockCount ?? 0,
      outOfStockCount: outOfStockCount ?? 0,
      pendingTransfers: pendingTransfers ?? 0,
      activeAlerts: activeAlerts ?? 0,
      topDevices,
      storeBreakdown,
    });

    // Send one email per admin so a single bad address doesn't block the rest
    const adminEmails = (adminProfiles ?? []).map((p) => p.email as string);
    let sent = 0;
    for (const email of adminEmails) {
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "reports@channels-stc.com",
        to: email,
        subject: `Monthly Inventory Report — ${monthLabel}`,
        html,
      });
      if (sendError) {
        console.error(`[monthly-report] Failed to send to ${email}:`, sendError);
      } else {
        sent++;
      }
    }

    if (sent === 0) {
      await supabase.from("automation_logs").insert({
        automation_type: "monthly_email_report",
        status: "error",
        records_processed: adminEmails.length,
        records_created: 0,
        details: { month: monthLabel, attempted_recipients: adminEmails.length },
        error_message: "Failed to send to any recipient",
        completed_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Failed to send to any recipient" }, { status: 500 });
    }

    // Log to automation_logs
    await supabase.from("automation_logs").insert({
      automation_type: "monthly_email_report",
      status: "success",
      records_processed: sent,
      records_created: sent,
      details: {
        month: monthLabel,
        recipients: sent,
        total_revenue: totalRevenue,
        total_units: totalUnits,
      },
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      month: monthLabel,
      recipients: sent,
    });
  } catch (err) {
    console.error("[monthly-report] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    await logMonthlyReportFailure(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
