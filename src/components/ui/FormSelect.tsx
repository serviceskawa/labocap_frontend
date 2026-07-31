"use client";

import { useId } from "react";
import type { MultiValue, SingleValue, StylesConfig } from "react-select";
import { cn } from "@/lib/utils";
import { LimitedSelect as Select } from "./LimitedSelect";
import { buildSelectStyles, SELECT_MENU_CLASSNAMES } from "./selectStyles";

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

// Styles react-select partagés — voir `selectStyles.ts`. Ce fichier en
// redéfinissait une copie légèrement différente (rayon, hauteur, taille de
// police), ce qui faisait diverger l'apparence des selects d'un écran à l'autre.
const selectStyles = buildSelectStyles(false);
const errorSelectStyles = buildSelectStyles(true);

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
          classNames={SELECT_MENU_CLASSNAMES}
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
          classNames={SELECT_MENU_CLASSNAMES}
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
