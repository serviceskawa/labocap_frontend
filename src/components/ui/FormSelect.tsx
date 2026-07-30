"use client";

import { useId } from "react";
import type {
  MultiValue,
  SingleValue,
  StylesConfig,
  GroupBase,
} from "react-select";
import { cn } from "@/lib/utils";
import { LimitedSelect as Select } from "./LimitedSelect";
import { SELECT_CONTROL_MIN_HEIGHT } from "./selectStyles";

export interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectBaseProps {
  label?: string;
  error?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
}

interface FormSelectSingleProps extends FormSelectBaseProps {
  isMulti?: false;
  value: SingleValue<SelectOption>;
  onChange: (value: SingleValue<SelectOption>) => void;
}

interface FormSelectMultiProps extends FormSelectBaseProps {
  isMulti: true;
  value: MultiValue<SelectOption>;
  onChange: (value: MultiValue<SelectOption>) => void;
}

type FormSelectProps = FormSelectSingleProps | FormSelectMultiProps;

const selectStyles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
    backgroundColor: state.isDisabled ? "#f9fafb" : "white",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#9ca3af",
    },
    fontSize: "0.875rem",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#9ca3af",
    fontSize: "0.875rem",
  }),
  option: (base, state) => ({
    ...base,
    // Sélection (statique) en BLEU PUR ; curseur (survol/navigation) en BLEU CLAIR.
    backgroundColor: state.isSelected
      ? "#2563eb"
      : state.isFocused
        ? "#eff6ff"
        : "white",
    color: state.isSelected ? "white" : "#374151",
    fontSize: "0.875rem",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "#dbeafe",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.5rem",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: "4px",
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#dbeafe",
    borderRadius: "0.375rem",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#1d4ed8",
    fontSize: "0.75rem",
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#1d4ed8",
    "&:hover": {
      backgroundColor: "#bfdbfe",
      color: "#1e40af",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#9ca3af",
    "&:hover": { color: "#4b5563" },
    cursor: "pointer",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#9ca3af",
    "&:hover": { color: "#4b5563" },
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: "#e5e7eb",
  }),
  input: (base) => ({
    ...base,
    fontSize: "0.875rem",
    color: "#111827",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "0.875rem",
    color: "#111827",
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: "0.875rem",
    color: "#9ca3af",
  }),
};

const errorSelectStyles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
  ...selectStyles,
  control: (base, state) => ({
    ...(selectStyles.control?.(base, state) as object),
    borderColor: state.isFocused ? "#ef4444" : "#fca5a5",
    boxShadow: state.isFocused ? "0 0 0 1px #ef4444" : "none",
  }),
};

export function FormSelect(props: FormSelectProps) {
  const {
    label,
    error,
    required = false,
    options,
    placeholder = "Sélectionner...",
    isClearable = false,
    isDisabled = false,
    className,
    name,
    id,
  } = props;

  const styles = error ? errorSelectStyles : selectStyles;

  // id stable garanti identique SSR/client → évite le mismatch d'hydratation
  // sur les éléments internes de react-select (live-region, placeholder…)
  const generatedId = useId();
  const instanceId = id ?? name ?? generatedId;

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
      {props.isMulti ? (
        <Select<SelectOption, true>
          instanceId={instanceId}
          inputId={id ?? name}
          name={name}
          options={options}
          isMulti
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          styles={styles as StylesConfig<SelectOption, true>}
          noOptionsMessage={() => "Aucune option"}
          classNamePrefix="react-select"
        />
      ) : (
        <Select<SelectOption, false>
          instanceId={instanceId}
          inputId={id ?? name}
          name={name}
          options={options}
          isMulti={false}
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          isClearable={isClearable}
          isDisabled={isDisabled}
          styles={styles as StylesConfig<SelectOption, false>}
          noOptionsMessage={() => "Aucune option"}
          classNamePrefix="react-select"
        />
      )}
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
