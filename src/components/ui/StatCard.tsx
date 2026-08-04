"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl bg-white p-5 shadow-[var(--elevation-flat)]",
        "transition-shadow duration-200 hover:shadow-[var(--elevation-raised)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-[.6875rem] font-semibold uppercase tracking-[0.07em] text-gray-500">{title}</p>
          <p className={cn("mt-2 truncate text-[1.625rem] font-bold leading-none tracking-[-0.02em]", valueClassName ?? "text-gray-900")}>
            {value}
          </p>
          {trend !== undefined && (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                trend.isPositive
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 rounded-xl bg-blue-50 p-3 text-blue-600 ring-1 ring-inset ring-blue-100 transition-colors duration-200 group-hover:bg-blue-100">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
