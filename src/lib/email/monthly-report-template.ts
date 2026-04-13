interface ReportData {
  month: string;           // e.g. "April 2026"
  totalRevenue: string;    // formatted BHD string
  totalSales: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingTransfers: number;
  activeAlerts: number;
  topDevices: { name: string; units: number; revenue: string }[];
  storeBreakdown: { name: string; revenue: string; sales: number }[];
}

export function buildMonthlyReportHtml(data: ReportData): string {
  const topDevicesRows = data.topDevices
    .map(
      (d, i) => `
      <tr style="border-bottom:1px solid #f1f0ef;">
        <td style="padding:10px 12px;font-size:13px;color:#374151;">${i + 1}. ${d.name}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:right;">${d.units} units</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:right;font-weight:600;">${d.revenue}</td>
      </tr>`
    )
    .join("");

  const storeRows = data.storeBreakdown
    .map(
      (s) => `
      <tr style="border-bottom:1px solid #f1f0ef;">
        <td style="padding:10px 12px;font-size:13px;color:#374151;">${s.name}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:right;">${s.sales} sales</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:right;font-weight:600;">${s.revenue}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monthly Report — ${data.month}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed;border-radius:16px 16px 0 0;padding:32px 32px 24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;">Channels by stc</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Monthly Inventory Report</h1>
              <p style="margin:8px 0 0;font-size:15px;color:#e9d5ff;">${data.month}</p>
            </td>
          </tr>

          <!-- KPI cards -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" style="padding:0 6px 16px 0;">
                    <div style="background:#f9f9f8;border:1px solid #e5e3e0;border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Revenue</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${data.totalRevenue}</p>
                    </div>
                  </td>
                  <td width="25%" style="padding:0 6px 16px;">
                    <div style="background:#f9f9f8;border:1px solid #e5e3e0;border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Sales</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${data.totalSales}</p>
                    </div>
                  </td>
                  <td width="25%" style="padding:0 6px 16px;">
                    <div style="background:#f9f9f8;border:1px solid #e5e3e0;border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Units Sold</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${data.totalUnits}</p>
                    </div>
                  </td>
                  <td width="25%" style="padding:0 0 16px 6px;">
                    <div style="background:#f9f9f8;border:1px solid #e5e3e0;border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Transfers</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${data.pendingTransfers} pending</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alerts row -->
          ${data.lowStockCount > 0 || data.outOfStockCount > 0 || data.activeAlerts > 0 ? `
          <tr>
            <td style="background:#ffffff;padding:0 32px 20px;">
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;">
                <p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">
                  ⚠️ Stock Alerts:
                  ${data.outOfStockCount > 0 ? `${data.outOfStockCount} out of stock` : ""}
                  ${data.lowStockCount > 0 ? ` · ${data.lowStockCount} low stock` : ""}
                  ${data.activeAlerts > 0 ? ` · ${data.activeAlerts} active system alerts` : ""}
                </p>
              </div>
            </td>
          </tr>` : ""}

          <!-- Top devices -->
          ${data.topDevices.length > 0 ? `
          <tr>
            <td style="background:#ffffff;padding:0 32px 24px;">
              <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;">Top Selling Devices</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f1f0ef;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9f9f8;">
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:left;text-transform:uppercase;">Device</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:right;text-transform:uppercase;">Units</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:right;text-transform:uppercase;">Revenue</th>
                  </tr>
                </thead>
                <tbody>${topDevicesRows}</tbody>
              </table>
            </td>
          </tr>` : ""}

          <!-- Store breakdown -->
          ${data.storeBreakdown.length > 0 ? `
          <tr>
            <td style="background:#ffffff;padding:0 32px 24px;">
              <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;">Store Breakdown</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f1f0ef;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9f9f8;">
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:left;text-transform:uppercase;">Store</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:right;text-transform:uppercase;">Sales</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#9ca3af;text-align:right;text-transform:uppercase;">Revenue</th>
                  </tr>
                </thead>
                <tbody>${storeRows}</tbody>
              </table>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f8;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #e5e3e0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                This report was automatically generated by the Channels by stc Smart Inventory System.<br/>
                © ${new Date().getFullYear()} Channels by stc — Bahrain
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
