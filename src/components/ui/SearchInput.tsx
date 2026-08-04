"use client";

import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Classe appliquée au conteneur (largeur, marges…). */
  className?: string;
}

/** Champ de recherche avec icône loupe intégrée. */
export function SearchInput({
  className,
  placeholder = "Rechercher...",
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-[.875rem] text-gray-800 shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/15"
        {...props}
      />
    </div>
  );
}
