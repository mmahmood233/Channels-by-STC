import { cn } from "@/utils/cn";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-100 text-surface-700",
  success: "bg-green-50 text-green-700 border border-green-100",
  warning: "bg-yellow-50 text-yellow-700 border border-yellow-100",
  danger: "bg-red-50 text-red-700 border border-red-100",
  info: "bg-blue-50 text-blue-700 border border-blue-100",
  purple: "bg-brand-50 text-brand-700 border border-brand-100",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
