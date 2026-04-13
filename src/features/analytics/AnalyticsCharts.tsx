"use client";

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface RevenuePoint { month: string; revenue: number }
interface DevicePoint  { name: string; revenue: number; units: number }
interface StorePoint   { store: string; revenue: number }
interface SellThrough  { name: string; rate: number; units: number }

interface Props {
  revenueOverTime: RevenuePoint[];
  topDevices: DevicePoint[];
  storeComparison: StorePoint[];
  sellThrough: SellThrough[];
  currency: string;
}

const BRAND_COLORS = [
  "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95",
  "#7e22ce", "#9333ea", "#a855f7", "#c084fc",
  "#d8b4fe", "#ede9fe",
];

function CurrencyTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-surface-100 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-surface-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "revenue"
            ? `${currency} ${Number(p.value).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
            : p.value}
        </p>
      ))}
    </div>
  );
}

function RateTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-surface-100 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-surface-700 mb-1">{label}</p>
      <p className="text-brand-600">Sell-Through: {payload[0]?.value}%</p>
      <p className="text-surface-500">Units Sold: {payload[0]?.payload?.units}</p>
    </div>
  );
}

export function AnalyticsCharts({ revenueOverTime, topDevices, storeComparison, sellThrough, currency }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

      {/* Revenue Over Time */}
      <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-soft lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-surface-800">Revenue Over Time (12 months)</h3>
        {revenueOverTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueOverTime} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip currency={currency} />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed"
                strokeWidth={2.5} dot={{ r: 3, fill: "#7c3aed" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-surface-400">No sales data yet</div>
        )}
      </div>

      {/* Top Devices by Revenue */}
      <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-surface-800">Top Devices by Revenue (All Time)</h3>
        {topDevices.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topDevices} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CurrencyTooltip currency={currency} />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                {topDevices.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-surface-400">No data yet</div>
        )}
      </div>

      {/* Store Comparison */}
      <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-surface-800">Store Revenue This Month</h3>
        {storeComparison.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={storeComparison} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
              <XAxis dataKey="store" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip currency={currency} />} />
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {storeComparison.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-surface-400">No data yet</div>
        )}
      </div>

      {/* Sell-Through Rate */}
      <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-soft lg:col-span-2">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-surface-800">Sell-Through Rate This Month</h3>
          <span className="text-xs text-surface-400">units sold ÷ (units sold + current stock)</span>
        </div>
        {sellThrough.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sellThrough} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<RateTooltip />} />
              <Bar dataKey="rate" name="Sell-Through %" radius={[4, 4, 0, 0]}>
                {sellThrough.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.rate >= 70 ? "#16a34a"
                    : entry.rate >= 40 ? "#d97706"
                    : "#dc2626"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-surface-400">No data yet</div>
        )}
      </div>

    </div>
  );
}
