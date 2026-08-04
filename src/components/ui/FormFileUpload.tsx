"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFileUploadProps {
  label?: string;
  error?: string;
  required?: boolean;
  accept?: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
  className?: string;
  name?: string;
  id?: string;
  hint?: string;
}

export function FormFileUpload({
  label,
  error,
  required = false,
  accept,
  multiple = false,
  onChange,
  className,
  name,
  id,
  hint,
}: FormFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id ?? name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border-2 border-dashed px-4 py-6 text-center transition-colors",
          error
            ? "border-red-300 bg-red-50 hover:bg-red-100"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
        )}
      >
        <Upload
          className={cn(
            "mb-2 h-8 w-8",
            error ? "text-red-400" : "text-gray-400"
          )}
        />
        <p className="text-sm font-medium text-gray-700">
          Cliquer pour sélectionner
        </p>
        {accept && (
          <p className="mt-0.5 text-xs text-gray-500">
            Formats acceptés : {accept}
          </p>
        )}
        {multiple && (
          <p className="mt-0.5 text-xs text-gray-500">
            Sélection multiple autorisée
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        id={id ?? name}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        aria-hidden="true"
      />

      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
