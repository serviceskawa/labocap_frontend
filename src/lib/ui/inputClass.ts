/**
 * Classe de champ de saisie partagée par tous les formulaires.
 *
 * Chacune des ~40 pages qui posent un formulaire déclarait auparavant sa propre
 * constante `inputClass` locale. Les copies avaient dérivé les unes des autres :
 * certaines omettaient `shadow-sm`, d'autres `placeholder:text-gray-400`, la
 * plupart n'avaient pas d'état désactivé — si bien qu'un même champ ne se
 * ressemblait pas d'un écran à l'autre. Cette constante est désormais la seule
 * source de vérité ; les états `disabled:` et `read-only:` sont inertes tant que
 * l'attribut correspondant est absent, elle convient donc à tous les cas.
 *
 * Correspond au style de {@link TextInput} : les deux doivent évoluer ensemble.
 *
 * @example
 * import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
 * <FormField label="Nom" required error={errors.name?.message}>
 *   <input type="text" {...register("name")} className={inputClass} />
 * </FormField>
 */
export const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[.9rem] " +
  "text-gray-800 shadow-sm transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-emphasized " +
  "placeholder:text-gray-400 " +
  "hover:border-gray-400 " +
  // Halo de 3px à faible opacité plutôt qu'un anneau plein de 1px : le focus
  // reste franc au clavier sans cerner le champ d'un trait dur.
  "focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/15 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "read-only:bg-gray-100 read-only:text-gray-500";
