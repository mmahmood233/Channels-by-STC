import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
        <Icon className="h-8 w-8 text-surface-300" />
      </div>
      <p className="text-sm font-semibold text-surface-600">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-surface-400">{description}</p>
      )}
    </div>
  );
}
