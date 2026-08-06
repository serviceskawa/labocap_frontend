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
  // Alignés sur INPUT_CLASS / .hyper-form-control : bordure neutre 300, focus
  // primaire avec halo de 3px.
  //
  // react-select ne lit pas les classes Tailwind. La version précédente
  // recopiait donc des hexadécimaux, en promettant de « les garder
  // synchronisées » — promesse jamais tenue : les valeurs étaient restées au
  // bleu Tailwind d'origine (#2563eb, #eff6ff, #dbeafe) que le remap de
  // `globals.css` n'a jamais touché. Les 23 écrans à sélecteurs étaient hors
  // palette depuis le passage à « Ardoise & Azur ».
  //
  // On référence désormais les jetons CSS eux-mêmes : le navigateur résout
  // `var(--color-blue-600)` dans un style en ligne comme ailleurs, et le
  // prochain changement de palette se propage sans toucher ce fichier. Les
  // halos passent par `color-mix`, faute de pouvoir composer une alpha sur une
  // variable en `rgba()`.
  const borderColor = hasError
    ? "var(--color-red-400)"
    : "var(--color-gray-300)";
  const hoverColor = hasError
    ? "var(--color-red-500)"
    : "var(--color-gray-400)";
  const focusColor = hasError
    ? "var(--color-red-500)"
    : "var(--color-blue-600)";
  const focusHalo = hasError
    ? "0 0 0 3px color-mix(in srgb, var(--color-red-500) 18%, transparent)"
    : "0 0 0 3px color-mix(in srgb, var(--color-blue-600) 18%, transparent)";

  return {
    control: (base, state) => ({
      ...base,
      minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
      borderRadius: "0.5rem",
      borderColor: state.isFocused ? focusColor : borderColor,
      boxShadow: state.isFocused
        ? focusHalo
        : "var(--elevation-flat)",
      backgroundColor: state.isDisabled ? "var(--color-gray-100)" : "white",
      paddingLeft: "2px",
      transition: "border-color .15s ease, box-shadow .15s ease",
      // `hoverColor` était déclaré sans jamais servir : le survol retombait sur
      // un gris en dur, y compris sur un champ en erreur, dont la bordure
      // rouge s'éteignait au passage de la souris.
      "&:hover": {
        borderColor: state.isFocused ? focusColor : hoverColor,
      },
      fontSize: "0.9rem",
    }),
    valueContainer: (base) => ({ ...base, padding: "2px 8px", gap: "4px" }),
    placeholder: (base) => ({
      ...base,
      color: "var(--color-gray-400)",
      fontSize: "0.9rem",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "0.625rem",
      overflow: "hidden",
      border: "1px solid var(--color-gray-200)",
      boxShadow: "var(--elevation-overlay)",
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
        ? "var(--color-blue-600)"
        : state.isFocused
          ? "var(--color-blue-50)"
          : "white",
      color: state.isSelected ? "white" : "var(--color-gray-700)",
      fontSize: "0.9rem",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "var(--color-blue-600)" : "var(--color-blue-100)",
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "var(--color-blue-100)",
      borderRadius: "0.375rem",
      overflow: "hidden",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "var(--color-blue-700)",
      fontSize: "0.75rem",
      fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "var(--color-blue-700)",
      "&:hover": { backgroundColor: "var(--color-blue-200)", color: "var(--color-blue-800)" },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "var(--color-gray-400)",
      cursor: "pointer",
      "&:hover": { color: "var(--color-gray-600)" },
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "var(--color-gray-400)",
      "&:hover": { color: "var(--color-gray-600)" },
    }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: "var(--color-gray-200)" }),
    input: (base) => ({ ...base, fontSize: "0.9rem", color: "var(--color-gray-900)" }),
    singleValue: (base) => ({ ...base, fontSize: "0.9rem", color: "var(--color-gray-900)" }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: "0.9rem",
      color: "var(--color-gray-400)",
    }),
  };
}
