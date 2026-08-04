"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
}

export function KpiCard({ title, value, trend, subtitle, icon, iconBg }: KpiCardProps) {
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className="group rounded-xl bg-white p-5 shadow-[var(--elevation-flat)] transition-shadow duration-200 hover:shadow-[var(--elevation-raised)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-[.6875rem] font-semibold uppercase tracking-[0.07em] text-gray-500">
            {title}
          </p>
          <p className="mt-2 truncate text-[1.625rem] font-bold leading-none tracking-[-0.02em] text-gray-900">{value}</p>

          {trend !== undefined && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {trend}%
              </span>
            </div>
          )}

          {subtitle && (
            <p className="mt-2 text-xs text-gray-400">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex-shrink-0 rounded-xl p-3 ring-1 ring-inset ring-black/[0.04]",
              iconBg ?? "bg-blue-50 text-blue-600"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
