import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildMonthlyReportHtml } from "@/lib/email/monthly-report-template";
import { CURRENCY_SYMBOL } from "@/constants";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatBhd(amount: number) {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString("en-BH", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

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
      { data: topDevicesRaw },
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
        .from("top_selling_devices_view")
        .select("device_name, total_units_sold, total_revenue")
        .order("total_revenue", { ascending: false })
        .limit(5),
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

    // Count unique transactions (approximate from monthly_sales_view rows as proxy)
    const totalSales = (salesData ?? []).length;

    // Top devices
    const topDevices = (topDevicesRaw ?? []).map((d) => ({
      name: d.device_name as string,
      units: d.total_units_sold as number,
      revenue: formatBhd(Number(d.total_revenue)),
    }));

    // Store breakdown from salesData
    const storeMap: Record<string, { revenue: number; sales: number }> = {};
    for (const row of salesData ?? []) {
      const name = row.store_name as string;
      storeMap[name] = {
        revenue: (storeMap[name]?.revenue ?? 0) + Number(row.total_revenue),
        sales: (storeMap[name]?.sales ?? 0) + 1,
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
      return NextResponse.json({ error: "Failed to send to any recipient" }, { status: 500 });
    }

    // Log to automation_logs
    await supabase.from("automation_logs").insert({
      script_name: "monthly_email_report",
      status: "success",
      records_processed: sent,
      message: `Monthly report for ${monthLabel} sent to ${sent} admin(s)`,
    });

    return NextResponse.json({
      success: true,
      month: monthLabel,
      recipients: sent,
    });
  } catch (err) {
    console.error("[monthly-report] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
