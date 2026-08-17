"use client";

import { useMemo, useState } from "react";
import ReactSelect, {
  createFilter,
  type GroupBase,
  type Props as ReactSelectProps,
} from "react-select";
import ReactCreatableSelect, {
  type CreatableProps,
} from "react-select/creatable";
import type { StylesConfig } from "react-select";
import { SELECT_CONTROL_MIN_HEIGHT } from "./selectStyles";

/**
 * Applique la hauteur commune au contrôle, en préservant les styles éventuels
 * fournis par l'appelant.
 */
function withSharedHeight<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>,
>(
  styles?: StylesConfig<Option, IsMulti, Group>,
): StylesConfig<Option, IsMulti, Group> {
  return {
    ...styles,
    control: (base, state) => ({
      ...(styles?.control ? styles.control(base, state) : base),
      minHeight: `${SELECT_CONTROL_MIN_HEIGHT}px`,
      borderRadius: "0.5rem",
    }),
  };
}

/**
 * Nombre maximum d'options affichées dans le menu déroulant.
 *
 * Six auparavant, sans défilement : au-delà, il fallait affiner sa recherche.
 * C'était trop peu pour les listes où l'on parcourt — un catalogue de 273
 * examens, une liste de patients — et l'utilisateur ne savait pas si la
 * troncature lui cachait la bonne réponse.
 *
 * La recherche continue de porter sur la **totalité** des options, jamais sur
 * les seules lignes affichées : cinquante est un plafond d'affichage, pas un
 * plafond de recherche.
 */
export const MAX_VISIBLE_OPTIONS = 50;

/**
 * Hauteur du menu, au-delà de laquelle il défile.
 *
 * Cinquante options ne peuvent pas tenir à l'écran : le menu défile désormais,
 * ce qu'il ne faisait pas quand il n'en montrait que six. La hauteur est
 * calculée pour laisser voir une dizaine de lignes — assez pour parcourir sans
 * masquer le reste de la page.
 */
const MENU_HEIGHT = 320;

const DEFAULT_FILTER = createFilter<unknown>();

function isGroup<Option, Group extends GroupBase<Option>>(
  entry: Option | Group
): entry is Group {
  return (
    !!entry &&
    typeof entry === "object" &&
    Array.isArray((entry as Group).options)
  );
}

/**
 * Recalcule les props passées à react-select :
 * - `options` : filtrées sur toute la liste puis tronquées à
 *   {@link MAX_VISIBLE_OPTIONS} ;
 * - `inputValue` / `onInputChange` : pilotés ici pour connaître la recherche en
 *   cours (le `onInputChange` éventuel de l'appelant reste appelé) ;
 * - `maxMenuHeight` : borne au-delà de laquelle le menu défile.
 */
function useLimitedSelectProps<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>,
>(props: ReactSelectProps<Option, IsMulti, Group>) {
  const [typedInput, setTypedInput] = useState("");
  const inputValue = props.inputValue ?? typedInput;

  const {
    options,
    value,
    isMulti,
    isSearchable,
    hideSelectedOptions,
    filterOption,
    getOptionLabel,
    getOptionValue,
    onInputChange,
  } = props;

  const visibleOptions = useMemo(() => {
    if (!options) return options;
    // Sans recherche, tronquer rendrait les options suivantes inatteignables.
    if (isSearchable === false) return options;

    const label = (o: Option) =>
      getOptionLabel
        ? getOptionLabel(o)
        : String((o as { label?: unknown }).label ?? "");
    const optValue = (o: Option) =>
      getOptionValue
        ? getOptionValue(o)
        : String((o as { value?: unknown }).value ?? "");

    // Options déjà choisies : react-select les masque par défaut en multi ;
    // on les écarte avant de tronquer, sinon on afficherait moins de 6 lignes.
    const hidden = hideSelectedOptions ?? isMulti ?? false;
    const chosen = new Set(
      hidden && Array.isArray(value) ? value.map((v) => optValue(v)) : []
    );

    const matches = filterOption ?? DEFAULT_FILTER;
    const kept: Option[] = [];

    for (const entry of options) {
      // Options groupées : on ne sait pas les tronquer proprement, on passe.
      if (isGroup<Option, Group>(entry)) return options;
      if (chosen.has(optValue(entry))) continue;
      if (
        !matches(
          { label: label(entry), value: optValue(entry), data: entry },
          inputValue
        )
      ) {
        continue;
      }
      kept.push(entry);
      if (kept.length === MAX_VISIBLE_OPTIONS) break;
    }

    return kept;
  }, [
    options,
    value,
    isMulti,
    isSearchable,
    hideSelectedOptions,
    filterOption,
    getOptionLabel,
    getOptionValue,
    inputValue,
  ]);

  return {
    ...props,
    styles: withSharedHeight(props.styles),
    options: visibleOptions,
    inputValue,
    onInputChange: (
      next: string,
      meta: Parameters<NonNullable<typeof onInputChange>>[1]
    ) => {
      setTypedInput(next);
      onInputChange?.(next, meta);
    },
    maxMenuHeight: MENU_HEIGHT,
    // Ouvre le menu vers le haut quand le champ est en bas de l'écran, et le
    // positionne en `fixed` (relatif au viewport) : sinon le menu, positionné en
    // `absolute`, allonge le document → la page « saute » et laisse un blanc en bas.
    menuPlacement: props.menuPlacement ?? "auto",
    menuPosition: props.menuPosition ?? "fixed",
  };
}

/**
 * react-select dont le menu affiche au plus {@link MAX_VISIBLE_OPTIONS} options,
 * en défilant au-delà de la hauteur retenue. La recherche interne porte sur la
 * liste complète : ce qui n'est pas visible se trouve en tapant quelques
 * lettres. Remplace `import Select from "react-select"` partout dans l'app.
 */
export function LimitedSelect<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(props: ReactSelectProps<Option, IsMulti, Group>) {
  return <ReactSelect {...useLimitedSelectProps(props)} />;
}

/**
 * Variante créable (saisie d'une valeur absente de la liste) de
 * {@link LimitedSelect}. La détection « cette valeur existe déjà » se fait sur
 * la liste complète, pas seulement sur les options affichées.
 */
export function LimitedCreatableSelect<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(props: CreatableProps<Option, IsMulti, Group>) {
  const limited = useLimitedSelectProps(props);
  const { options, getOptionLabel, isValidNewOption } = props;

  const validNewOption =
    isValidNewOption ??
    ((input: string) => {
      const typed = input.trim().toLowerCase();
      if (!typed) return false;
      const all = (options ?? []) as readonly (Option | Group)[];
      return !all.some((entry) => {
        if (isGroup<Option, Group>(entry)) return false;
        const label = getOptionLabel
          ? getOptionLabel(entry)
          : String((entry as { label?: unknown }).label ?? "");
        return label.trim().toLowerCase() === typed;
      });
    });

  return (
    <ReactCreatableSelect
      {...limited}
      isValidNewOption={
        validNewOption as CreatableProps<
          Option,
          IsMulti,
          Group
        >["isValidNewOption"]
      }
    />
  );
}
