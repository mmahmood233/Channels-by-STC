import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel: Brand Side ─────────────────────────────────────── */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-800 to-brand-900" />

        {/* Animated decorative shapes */}
        <div className="absolute top-20 left-20 h-72 w-72 animate-float rounded-full bg-brand-600/20 blur-3xl" />
        <div
          className="absolute right-16 bottom-32 h-96 w-96 animate-float rounded-full bg-accent-500/10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/3 h-64 w-64 animate-pulse-slow rounded-full bg-brand-400/10 blur-3xl"
          style={{ animationDelay: "4s" }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex max-w-md flex-col items-center px-12 text-center">
          {/* Logo */}
          <Image
            src="/images/logoSTC.png"
            alt="Channels by stc"
            width={220}
            height={55}
            className="mb-12 brightness-0 invert"
            priority
          />

          {/* Tagline */}
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-white">
            Smart Inventory
            <br />
            <span className="bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">
              & Stock Automation
            </span>
          </h1>
          <p className="mb-12 text-base leading-relaxed text-white/60">
            Manage devices, track sales, forecast demand, and make data-driven
            decisions with AI-powered insights across all your branches.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Real-time Inventory",
              "AI Forecasting",
              "Smart Chatbot",
              "Multi-branch",
            ].map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom decorative pixels (matching logo style) */}
        <div className="absolute bottom-8 left-8 flex gap-1.5 opacity-30">
          <div className="h-3 w-3 rounded-sm bg-accent-500" />
          <div className="h-3 w-3 rounded-sm bg-accent-500" />
          <div className="h-3 w-3 rounded-sm bg-white/40" />
        </div>
        <div className="absolute bottom-8 left-8 mt-5 flex translate-y-[18px] gap-1.5 opacity-30">
          <div className="h-3 w-3 rounded-sm bg-white/40" />
          <div className="h-3 w-3 rounded-sm bg-white/40" />
        </div>
      </div>

      {/* ── Right Panel: Form Side ─────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
