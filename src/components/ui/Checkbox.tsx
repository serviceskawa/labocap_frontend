"use client";

import { useId } from "react";
import type { InputHTMLAttributes, Ref } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Libellé affiché à droite de la case. */
  label?: string;
  ref?: Ref<HTMLInputElement>;
  /** Classe appliquée au conteneur (le label cliquable). */
  className?: string;
}

/**
 * Case à cocher au design personnalisé (case bleue + coche blanche animée).
 * Compatible avec `register` de react-hook-form (le `ref` est transmis).
 */
export function Checkbox({
  label,
  className,
  ref,
  id,
  disabled,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-2 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <span className="relative inline-flex h-4 w-4">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-[0.3rem] border border-gray-300 bg-white shadow-sm transition-colors hover:border-gray-400 checked:border-blue-600 checked:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-gray-100"
          {...props}
        />
        <Check
          className="pointer-events-none absolute inset-0 h-4 w-4 scale-0 text-white transition-transform peer-checked:scale-100"
          strokeWidth={3}
        />
      </span>
      {label && <span className="text-[.875rem] text-gray-700">{label}</span>}
    </label>
  );
}
