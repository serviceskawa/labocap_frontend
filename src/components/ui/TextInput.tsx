"use client";

import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Applique le style d'erreur (bordure rouge). */
  error?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Champ de saisie natif stylé, compatible avec `register` de react-hook-form
 * (le `ref` renvoyé par register est transmis en prop — React 19).
 */
export function TextInput({ className, error, ref, ...props }: TextInputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        // Aligné sur INPUT_CLASS (`src/lib/ui/inputClass.ts`) : les deux doivent
        // rester identiques, un champ ne peut pas dépendre du composant choisi.
        "w-full rounded-lg border bg-white px-3 py-2 text-[.9rem] text-gray-800",
        "shadow-sm transition-[border-color,box-shadow] duration-150",
        "placeholder:text-gray-400 focus:outline-none focus:ring-[3px]",
        "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
        error
          ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
          : "border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500/15",
        className
      )}
      {...props}
    />
  );
}
