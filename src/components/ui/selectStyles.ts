import type { StylesConfig, GroupBase, ClassNamesConfig } from "react-select";
import type { SelectOption } from "./FormSelect";

/**
 * Classe appliquée au menu déroulant (voir `.select-menu-scroll` dans
 * globals.css). Le menu est borné à 6 options, il n'y a donc normalement rien
 * à faire défiler.
 */
export const SELECT_MENU_CLASSNAMES: ClassNamesConfig<
  SelectOption,
  boolean,
  GroupBase<SelectOption>
> = {
  menuList: () => "select-menu-scroll",
};

/**
 * Styles react-select partagés (design soigné, cohérent avec l'app).
 * Passe `hasError` à true pour la variante bordure rouge.
 */
/**
 * Hauteur commune à TOUS les champs de sélection de l'application — react-select
 * comme `<select>` natif. Les hauteurs divergeaient d'un écran à l'autre parce
 * que `LimitedSelect` n'appliquait pas ces styles partagés et retombait sur le
 * défaut de react-select.
 */
export const SELECT_CONTROL_MIN_HEIGHT = 40;

export function buildSelectStyles(
  hasError: boolean
): StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> {
  // Alignés sur INPUT_CLASS / .hyper-form-control : bordure ardoise 300,
  // focus azur avec halo de 3px. react-select ne lit pas les classes Tailwind,
  // les valeurs sont donc reprises ici — les garder synchronisées.
  const borderColor = hasError ? "#f87171" : "#cbd5e1";
  const hoverColor = hasError ? "#ef4444" : "#94a3b8";
  const focusColor = hasError ? "#ef4444" : "#3f63ec";
  const focusHalo = hasError
    ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
    : "0 0 0 3px rgba(63, 99, 236, 0.15)";

  return {
    control: (base, state) => ({
      ...base,
      minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
      borderRadius: "0.5rem",
      borderColor: state.isFocused ? focusColor : borderColor,
      boxShadow: state.isFocused
        ? focusHalo
        : "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
      backgroundColor: state.isDisabled ? "#f1f5f9" : "white",
      paddingLeft: "2px",
      transition: "border-color .15s ease, box-shadow .15s ease",
      "&:hover": {
        borderColor: state.isFocused ? focusColor : "#9ca3af",
      },
      fontSize: "0.9rem",
    }),
    valueContainer: (base) => ({ ...base, padding: "2px 8px", gap: "4px" }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
      fontSize: "0.9rem",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "0.625rem",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      boxShadow:
        "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)",
      zIndex: 50,
    }),
    // Menu rendu via un portail (menuPortal) : doit passer au-dessus des cartes
    // et des conteneurs à `overflow` (ex. tableaux) pour ne pas être rogné.
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    // Pas de `maxHeight` : le menu ne défile jamais, il est borné à 6 options
    // (voir MAX_VISIBLE_OPTIONS dans LimitedSelect).
    menuList: (base) => ({
      ...base,
      padding: "6px",
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: "0.375rem",
      padding: "8px 10px",
      marginBottom: "2px",
      // Sélection (statique) en BLEU PUR ; curseur (survol/navigation) en BLEU CLAIR.
      backgroundColor: state.isSelected
        ? "#2563eb"
        : state.isFocused
          ? "#eff6ff"
          : "white",
      color: state.isSelected ? "white" : "#374151",
      fontSize: "0.9rem",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "#2563eb" : "#dbeafe",
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#dbeafe",
      borderRadius: "0.375rem",
      overflow: "hidden",
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
      "&:hover": { backgroundColor: "#bfdbfe", color: "#1e40af" },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "#9ca3af",
      cursor: "pointer",
      "&:hover": { color: "#4b5563" },
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "#9ca3af",
      "&:hover": { color: "#4b5563" },
    }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#e5e7eb" }),
    input: (base) => ({ ...base, fontSize: "0.9rem", color: "#111827" }),
    singleValue: (base) => ({ ...base, fontSize: "0.9rem", color: "#111827" }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: "0.9rem",
      color: "#9ca3af",
    }),
  };
}
