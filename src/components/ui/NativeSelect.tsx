"use client";

import {
  Children,
  isValidElement,
  useMemo,
  type ChangeEvent,
  type ChangeEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
  type Ref,
} from "react";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";
import { LimitedCreatableSelect as CreatableSelect } from "./LimitedSelect";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  /** Applique le style d'erreur (bordure rouge). */
  error?: boolean;
  ref?: Ref<HTMLSelectElement>;
  /** Classe appliquée au conteneur (largeur, marges…). */
  className?: string;
  /** Classe appliquée au `<select>` natif lui-même (variante non enrichie). */
  selectClassName?: string;
  /** Placeholder (utilisé en mode enrichi react-select). */
  placeholder?: string;
  /**
   * onChange compatible `<select>` natif : reçoit un événement dont
   * `target.value` porte la valeur choisie (en mode enrichi react-select,
   * un événement synthétique de même forme est fourni).
   */
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  /**
   * Autorise la saisie d'une nouvelle valeur absente de la liste.
   * `onCreateOption` est appelé avec le texte saisi (à charger de créer
   * l'entité côté backend puis de la sélectionner).
   */
  creatable?: boolean;
  onCreateOption?: (input: string) => void;
}

type Opt = { value: string; label: string; isDisabled?: boolean };

/**
 * Extrait récursivement les `<option>` (y compris ceux issus de `.map()` ou
 * de fragments) en une liste d'options react-select.
 */
function extractOptions(children: ReactNode, acc: Opt[]): void {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      };
      const value = String(props.value ?? "");
      const label =
        typeof props.children === "string"
          ? props.children
          : Array.isArray(props.children)
            ? props.children.filter((c) => typeof c === "string").join("")
            : String(props.children ?? value);
      acc.push({ value, label, isDisabled: props.disabled });
    } else {
      // Fragment ou wrapper : on descend dans ses enfants.
      const props = child.props as { children?: ReactNode };
      if (props?.children) extractOptions(props.children, acc);
    }
  });
}

/**
 * Au-delà de ce nombre de données réelles (hors option « vide/Tous »), la liste
 * devient un select react-select cherchable, borné à 6 options affichées.
 * En dessous, on garde le `<select>` natif à l'identique.
 */
const ENHANCE_THRESHOLD = 5;

/**
 * `<select>` moderne. Pour les listes courtes (≤ 5 données) : `<select>` natif.
 * Pour les listes longues (> 5 données) : react-select **cherchable**, borné à
 * 6 options affichées (la recherche porte sur toute la liste), et
 * optionnellement **créable** (`creatable` + `onCreateOption`). L'API (`value` +
 * `onChange` façon événement natif) reste identique dans les deux cas.
 */
export function NativeSelect({
  className,
  selectClassName,
  error,
  ref,
  children,
  value,
  onChange,
  disabled,
  placeholder,
  name,
  id,
  creatable,
  onCreateOption,
  ...props
}: NativeSelectProps) {
  const options = useMemo(() => {
    const acc: Opt[] = [];
    extractOptions(children, acc);
    return acc;
  }, [children]);

  const dataCount = options.filter((o) => o.value !== "").length;
  const enhance = dataCount > ENHANCE_THRESHOLD;

  if (enhance) {
    const current = String(value ?? "");
    const selected = options.find((o) => o.value === current) ?? null;
    const portalTarget =
      typeof document !== "undefined" ? document.body : undefined;

    const commonProps = {
      inputId: id,
      name,
      options,
      value: selected,
      isDisabled: disabled,
      isSearchable: true,
      placeholder: placeholder ?? "Sélectionner...",
      classNamePrefix: "react-select",
      menuPortalTarget: portalTarget,
      styles: { menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }) },
      onChange: (opt: Opt | null) =>
        onChange?.({
          target: { value: opt?.value ?? "", name },
        } as unknown as ChangeEvent<HTMLSelectElement>),
      noOptionsMessage: () => "Aucun résultat",
    };

    return (
      <div className={cn("group relative", className)}>
        {creatable ? (
          <CreatableSelect
            {...commonProps}
            onCreateOption={onCreateOption}
            formatCreateLabel={(input: string) => `Ajouter « ${input} »`}
          />
        ) : (
          <ReactSelect {...commonProps} />
        )}
      </div>
    );
  }

  // Liste courte : `<select>` natif inchangé.
  return (
    <div className={cn("group relative", className)}>
      <select
        ref={ref}
        value={value}
        disabled={disabled}
        name={name}
        id={id}
        onChange={onChange as SelectHTMLAttributes<HTMLSelectElement>["onChange"]}
        className={cn(
          "native-select w-full cursor-pointer rounded-lg border bg-white px-3 py-2 min-h-[40px] pr-10 text-sm text-gray-700 shadow-sm outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
            : "border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors",
          !error && "group-focus-within:text-blue-500"
        )}
      />
    </div>
  );
}
