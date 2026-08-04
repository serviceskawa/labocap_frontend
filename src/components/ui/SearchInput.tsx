"use client";

import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

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
        className={`${inputClass} pl-9`}
        {...props}
      />
    </div>
  );
}
