/**
 * Modules optionnels de l'application (cf. docs/modules.md).
 *
 * Une même image Docker sert tous les laboratoires : les modules activés se
 * lisent donc AU RUNTIME dans la variable serveur `APP_MODULES` — liste séparée
 * par des virgules, ex. `APP_MODULES=biology,agenda`. Surtout pas de préfixe
 * `NEXT_PUBLIC_`, qui figerait la valeur à la compilation.
 *
 * Variable absente ou vide → aucun module : l'application se comporte
 * exactement comme avant l'introduction des modules.
 *
 * Tout est pur ici, sauf `getEnabledModules()` qui lit l'environnement et
 * n'a de sens que côté serveur (proxy, layouts). Le client reçoit la liste
 * par `ModulesProvider` / `useModules()`.
 */

export type AppModule = "biology" | "agenda";

export const APP_MODULES: readonly AppModule[] = ["biology", "agenda"];

/** Préfixes de routes propres à chaque module, bloqués quand il est désactivé. */
export const MODULE_ROUTE_PREFIXES: Record<AppModule, string[]> = {
  biology: ["/biologie"],
  agenda: ["/agenda"],
};

/**
 * Permissions propres à chaque module, masquées quand il est désactivé.
 *
 * Les migrations créent ces droits et les attachent aux rôles existants, pour
 * que le module soit utilisable le jour où on l'allume. Mais l'écran des rôles
 * liste tout ce que le serveur renvoie : sans ce filtre, « Valider les
 * comptes-rendus de biologie » s'affiche chez un laboratoire qui ne fait pas de
 * biologie, et l'administrateur se demande ce qu'il a manqué.
 *
 * Les slugs sont énumérés plutôt que devinés par préfixe. Un `startsWith` sur
 * « view-biology » paraît suffisant jusqu'au jour où une permission sort du
 * motif, et le filtre échoue alors en silence — dans le sens qui montre ce
 * qu'on voulait cacher. Une liste se relit et se cherche.
 */
export const MODULE_PERMISSION_SLUGS: Record<AppModule, readonly string[]> = {
  biology: [
    "view-biology-results",
    "edit-biology-results",
    "validate-biology-results",
    "validate-biology-reports",
    "manage-biology-parameters",
  ],
  agenda: [
    "view-appointments",
    "create-appointments",
    "edit-appointments",
    "delete-appointments",
  ],
};

/**
 * Ce droit relève-t-il d'un module éteint ?
 *
 * <p>Masquer n'est pas retirer : la ligne reste en base, et le droit reprend
 * effet dès que le module est rallumé. C'est délibéré — les révoquer à
 * l'extinction ferait perdre des attributions que personne n'a décidé de
 * retirer, et il faudrait les refaire une à une au rallumage.</p>
 */
export function permissionCacheeParModule(
  slug: string,
  modulesActifs: readonly AppModule[],
): boolean {
  return APP_MODULES.some(
    (m) => !modulesActifs.includes(m) && MODULE_PERMISSION_SLUGS[m].includes(slug),
  );
}

function isAppModule(value: string): value is AppModule {
  return (APP_MODULES as readonly string[]).includes(value);
}

/**
 * Lit une liste de modules (`"biology, Agenda"`) : espaces et casse ignorés,
 * valeurs inconnues écartées, doublons supprimés.
 */
export function parseModules(raw?: string): AppModule[] {
  if (!raw) return [];
  const modules = raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(isAppModule);
  return [...new Set(modules)];
}

/**
 * Module auquel appartient une route, ou `null`. Le préfixe doit s'arrêter sur
 * une frontière de segment : `/biologie` et `/biologie/x` relèvent du module,
 * `/biologiex` non.
 */
export function moduleForPath(pathname: string): AppModule | null {
  for (const appModule of APP_MODULES) {
    const matches = MODULE_ROUTE_PREFIXES[appModule].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (matches) return appModule;
  }
  return null;
}

/**
 * Modules activés pour ce déploiement. Serveur uniquement : côté navigateur,
 * `process.env.APP_MODULES` n'existe pas (et ne doit pas exister).
 */
export function getEnabledModules(): AppModule[] {
  return parseModules(process.env.APP_MODULES);
}
