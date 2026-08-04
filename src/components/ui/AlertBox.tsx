"use client";

import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBoxProps {
  type: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const alertConfig = {
  success: {
    container: "bg-green-50 ring-1 ring-inset ring-green-200 text-green-800",
    icon: CheckCircle,
    iconClass: "text-green-600",
    dismissClass: "text-green-500 hover:bg-green-100",
  },
  error: {
    container: "bg-red-50 ring-1 ring-inset ring-red-200 text-red-800",
    icon: XCircle,
    iconClass: "text-red-600",
    dismissClass: "text-red-500 hover:bg-red-100",
  },
  warning: {
    container: "bg-amber-50 ring-1 ring-inset ring-amber-200 text-amber-800",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    dismissClass: "text-amber-600 hover:bg-amber-100",
  },
  info: {
    container: "bg-blue-50 ring-1 ring-inset ring-blue-200 text-blue-800",
    icon: Info,
    iconClass: "text-blue-600",
    dismissClass: "text-blue-500 hover:bg-blue-100",
  },
} as const;

export function AlertBox({
  type,
  title,
  message,
  onDismiss,
  className,
}: AlertBoxProps) {
  const config = alertConfig[type];
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.container,
        className
      )}
    >
      <IconComponent className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconClass)} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold">{title}</p>
        )}
        <p className={cn("text-sm", title && "mt-0.5")}>{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 rounded p-0.5 transition-colors",
            config.dismissClass
          )}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
