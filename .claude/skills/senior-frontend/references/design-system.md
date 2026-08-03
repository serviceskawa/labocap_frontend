# Système de design « Ardoise & Azur »

Implémenté dans `src/app/globals.css` (couche de tokens) et dans les primitives
de `src/components/ui`. Ce document dit *pourquoi* ; le CSS dit *comment*.

Remplace la palette Hyper d'origine (périwinkle `#727cf5`, menthe `#0acf97`,
rose `#fa5c7c`), héritée d'un thème Bootstrap acheté.

## Principe de construction

Les accents partagent une **même luminosité et une même chroma** ; seule la
teinte change. C'est ce qui les fait cohabiter dans un tableau dense sans
qu'aucun ne crie plus fort que les autres.

```
azur 226°  ·  émeraude 162°  ·  ciel 200°  ·  ambre 38°  ·  rose 348°
```

Les neutres sont des **ardoises froides** (bleutées), accordées à l'azur : un
gris neutre posé à côté d'un primaire bleu paraît sale par contraste.

## Palette

| Rôle | Hexa (600) | Classe à écrire |
|---|---|---|
| primaire — azur | `#2e4bd8` | `blue-600`, `indigo-600` |
| succès — émeraude | `#059669` | `green-600`, `emerald-600` |
| info — ciel | `#0284c7` | `cyan-600`, `sky-600` |
| alerte — ambre | `#d97706` | `amber-600`, `yellow-600` |
| danger — rose | `#dc2848` | `red-600` |
| encre forte | `#0f172a` | `gray-900` |
| encre courante | `#475569` | `gray-600` |
| encre atténuée | `#94a3b8` | `gray-400` |
| bordure | `#cbd5e1` | `gray-300` |
| séparateur | `#e2e8f0` | `gray-200` |
| fond de page | `#f5f7fa` | (`body`) |
| surface | `#ffffff` | `bg-white` |

Échelles complètes dans le bloc `@theme` de `globals.css`. `slate-*` est un
alias de `gray-*` : les deux pointent sur la même rampe.

### Le remap, et son piège

Les échelles Tailwind sont **redéfinies**. Écrire l'hexa en dur court-circuite le
système : le pixel est bon aujourd'hui, il ne suivra aucune évolution.

Les paliers ne sont pas tous distincts comme en Tailwind standard — vérifier la
valeur dans `globals.css` avant de choisir une nuance intermédiaire.

Hors palette : `stone-*`, `zinc-*`, `lime-*`, `fuchsia-*`, `pink-*` gardent leurs
valeurs Tailwind par défaut. Ne pas les introduire.

## Forme et profondeur

Deux rayons, trois élévations, déclarés en variables sur `:root` :

| Token | Valeur | Usage |
|---|---|---|
| `--radius-control` | `0.5rem` | boutons, champs, badges, pastilles |
| `--radius-surface` | `0.75rem` | cartes, modales, menus |
| `--elevation-flat` | ombre de contact + liseré | carte au repos |
| `--elevation-raised` | + ombre d'ambiance | carte survolée, popover |
| `--elevation-overlay` | ombre longue | menu déroulant, modale |

L'élévation se joue en **deux couches** — une ombre courte et nette qui pose
l'objet, une ombre large et faible qui l'ambiance — plus un liseré à très faible
opacité qui tient le bord. C'est ce trio qui donne la matière ; une ombre unique
très diffuse (l'ancien `0 0 35px rgba(…,.15)`) donne un halo, pas un relief.

Ne pas inventer d'ombre sur place : prendre un des trois tokens.

## Typographie

Police **Nunito**, chargée par `next/font/google` (auto-hébergée au build).

| Élément | Taille | Graisse | Note |
|---|---|---|---|
| corps | `0.9rem` | 400 | `#475569` |
| titre de page | `1.25rem` | 600 | `tracking-[-0.015em]`, via `PageHeader` |
| en-tête de carte | `0.9375rem` | 600 | casse **normale** |
| en-tête de tableau | `0.7rem` | 600 | majuscules, `tracking-[0.06em]`, gris 500 |
| cellule de tableau | `0.875rem` | 400 | |
| badge | `0.75rem` | 600 | |

**Pas de `text-transform: uppercase` sur les titres.** Les majuscules hachent la
lecture des libellés français longs et de leurs accents (« RÉCAPITULATIF DES
DÉPENSES »). Elles restent réservées aux en-têtes de tableau, où le libellé est
court et où elles servent à distinguer l'étiquette de la donnée.

## Composants

### Boutons

Rayon `0.5rem`, graisse 500, padding `0.5rem 0.9rem`. Le survol **assombrit d'un
cran** et pose une ombre teintée courte. L'ancien comportement (fond inchangé,
ombre à 50 % d'opacité) ne donnait pas de retour franc au pointeur et bavait sur
les surfaces claires.

`secondary` a une vraie hiérarchie : bordure au repos, fond au survol.

Anneau de focus visible au clavier (`focus-visible:ring-2`).

### Actions de ligne (`IconButton`)

Pastilles carrées de **32px**, fond **teinté** au repos (palier 50) et icône à la
couleur pleine ; au survol, le fond devient plein et l'icône blanche.

Les fonds pleins et saturés d'origine transformaient chaque tableau en damier de
pastilles colorées : trois par ligne sur des dizaines de lignes, la couleur ne
signalait plus rien.

### Badges

Fond palier 50, texte palier 700/800, liseré interne palier 200. L'ancien style
« lighten » (teinte du statut à 18 % d'opacité, texte à la couleur pleine) tombait
sous 3:1 de contraste et devenait illisible en petite taille.

### Champs

Rayon `0.5rem`, bordure `gray-300`, survol `gray-400`, focus = bordure primaire
**plus un halo de 3px à 15 % d'opacité**. Le focus d'origine se contentait de
griser la bordure : presque invisible, et rien pour le clavier.

Source unique : `INPUT_CLASS` (`src/lib/ui/inputClass.ts`) et `TextInput`, qui
doivent rester identiques. `.hyper-form-control` porte la même définition en CSS.

### Tableaux (`DataTable`)

En-tête sur fond **blanc**, libellés en petites capitales espacées, gris 500.
**Pas de zébrage** : deux fonds alternés bruitent une grille dense et noyaient le
survol une ligne sur deux. Un filet `gray-100` entre les lignes suffit à guider
l'œil ; le survol est un azur très dilué (`blue-50/40`).

### Coque

- Menu latéral : ardoise profonde `#0f172a`, liseré droit à 12 % d'opacité.
  Élément actif = azur plein + ombre teintée courte.
- Barre du haut : blanc, **bordure basse de 1px**. Une bordure nette sépare mieux
  qu'une ombre diffuse et ne salit pas le blanc du contenu.

## Graphiques

Les couleurs de recharts passent en props JavaScript et échappent au remap
Tailwind : elles vivent dans `src/lib/ui/chartColors.ts`.

- `CHART_CATEGORICAL` — séries d'identité, **ordre fixe**, jamais réordonné selon
  les valeurs (une couleur suit l'entité, pas son rang).
- `CHART_STATUS` — états réservés (`good` / `warning` / `critical` / `neutral`),
  toujours accompagnés d'un libellé.
- `CHART_GRID` — grille et axes, volontairement discrets.

L'ordre catégoriel a été **calculé, pas choisi à l'œil**. L'émeraude et le rose ne
sont pas voisins : la paire rouge/vert adjacente tombait à ΔE 5,6 en deutéranopie.
Toute modification doit repasser le validateur — commande dans l'en-tête du
fichier.

## react-select

Stylé globalement via `classNamePrefix="react-select"`. Deux règles à connaître :

- La hauteur du contrôle (`min-height: 40px`) est fixée **en CSS avec
  `!important`**, pas en JS. Elle doit rester égale à `SELECT_CONTROL_MIN_HEIGHT`
  de `components/ui/selectStyles.ts`.
- Le menu affiche **6 options maximum, sans défilement** (`nth-child(n+7)` masqué).
  C'est délibéré : on attend de l'utilisateur qu'il tape pour filtrer.

## `<select>` natif moderne

`NativeSelect` s'appuie sur `appearance: base-select` + `::picker(select)`, avec
repli sur Firefox/Safari.

Piège : ne jamais mettre `color: #ffffff` sur `option:checked` sans le garde
`:not(:open)`. Chromium clone l'option cochée dans le champ **fermé** (fond
blanc) → texte blanc sur blanc, valeur invisible.

## Impression

La coque est masquée par des variantes `print:` dans `app/(dashboard)/layout.tsx`.
`globals.css` ajoute `print-color-adjust: exact` pour que badges et couleurs
sortent fidèlement. Toute page destinée à l'impression doit rester lisible une
fois la coque retirée.
