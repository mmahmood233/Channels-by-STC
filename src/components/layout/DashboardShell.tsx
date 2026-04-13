"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  alertCount?: number;
  userId: string;
  storeId: string | null;
}

export function DashboardShell({
  children,
  userRole,
  userName,
  userEmail,
  alertCount = 0,
  userId,
  storeId,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMobileMenuOpen={() => setMobileOpen(true)}
          alertCount={alertCount}
          userId={userId}
          storeId={storeId}
          userRole={userRole}
        />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
