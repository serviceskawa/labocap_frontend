"use client";

import { cn } from "@/lib/utils";

interface FormToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
  id?: string;
  className?: string;
}

export function FormToggle({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
  id,
  className,
}: FormToggleProps) {
  const toggleId = id ?? `toggle-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* Switch */}
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-[var(--duration-fast)] ease-emphasized focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          checked ? "bg-blue-600" : "bg-gray-200",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/[0.04] transition duration-[var(--duration-fast)] ease-emphasized",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>

      {/* Label */}
      <div className="flex flex-col">
        <label
          htmlFor={toggleId}
          className={cn(
            "text-[.875rem] font-medium",
            disabled ? "cursor-not-allowed text-gray-400" : "cursor-pointer text-gray-700"
          )}
        >
          {label}
        </label>
        {hint && (
          <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        )}
      </div>
    </div>
  );
}
