import Image from "next/image";
import {
  BarChart3, Package, ArrowLeftRight,
  ShoppingCart, Bot, TrendingUp,
} from "lucide-react";

const FEATURES = [
  { icon: Package,         label: "Live Inventory",     desc: "Real-time stock across all branches" },
  { icon: ShoppingCart,    label: "Sales Tracking",     desc: "Record & monitor every transaction" },
  { icon: ArrowLeftRight,  label: "Smart Transfers",    desc: "Request & approve stock movements" },
  { icon: TrendingUp,      label: "AI Forecasting",     desc: "Predict demand before it happens" },
  { icon: BarChart3,       label: "Analytics",          desc: "Revenue charts & store comparison" },
  { icon: Bot,             label: "AI Chatbot",         desc: "Ask anything about your inventory" },
];

const STATS = [
  { value: "6+",   label: "Stores" },
  { value: "100+", label: "Devices" },
  { value: "Real-time", label: "Updates" },
  { value: "AI",   label: "Powered" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-50">

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[52%] lg:flex-col">

        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0040] via-[#2d0070] to-[#1a0040]" />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow blobs */}
        <div className="absolute -top-32 -left-32 h-96 w-96 animate-float rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] animate-float rounded-full bg-accent-500/10 blur-3xl"
          style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse-slow rounded-full bg-brand-400/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col px-12 py-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/logoSTC.png"
              alt="Channels by stc"
              width={160}
              height={40}
              className="brightness-0 invert"
              priority
            />
          </div>

          {/* Main headline */}
          <div className="mt-16">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-xs font-medium text-white/70">Smart Inventory System</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Manage Your
              <br />
              <span className="bg-gradient-to-r from-accent-400 via-accent-300 to-brand-300 bg-clip-text text-transparent">
                Inventory Smarter
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
              Unified platform for stock tracking, demand forecasting, and AI-powered
              insights across all Channels by stc branches in Bahrain.
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-4 gap-3">
            {STATS.map((s) => (
              <div key={s.label}
                className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-center backdrop-blur-sm">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="mt-0.5 text-[10px] font-medium text-white/50">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label}
                className="group flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/8">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600/40">
                  <Icon className="h-4 w-4 text-brand-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/90">{label}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8">
            <div className="flex items-center gap-3 border-t border-white/8 pt-6">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-sm bg-accent-500 opacity-80" />
                <div className="h-2 w-2 rounded-sm bg-accent-500 opacity-80" />
                <div className="h-2 w-2 rounded-sm bg-white/30" />
              </div>
              <p className="text-xs text-white/30">
                © {new Date().getFullYear()} Channels by stc · Bahrain · Graduation Project
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col lg:w-[48%]">
        {/* Mobile top bar */}
        <div className="flex items-center justify-center border-b border-surface-100 py-5 lg:hidden">
          <Image
            src="/images/logoSTC.png"
            alt="Channels by stc"
            width={140}
            height={35}
            priority
          />
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        {/* Bottom footer — desktop */}
        <div className="hidden border-t border-surface-100 px-8 py-4 lg:block">
          <p className="text-center text-xs text-surface-400">
            © {new Date().getFullYear()} Channels by stc · Smart Inventory & Stock Automation System
          </p>
        </div>
      </div>

    </div>
  );
}
