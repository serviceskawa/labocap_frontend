# Kit UI — catalogue

Avant d'écrire un composant, chercher ici. Le kit couvre l'essentiel des besoins
d'un écran CRUD ; réimplémenter à la main produit systématiquement une dérive
visuelle par rapport à Laravel.

Import : `@/components/ui/…` (barrel `@/components/ui`) et `@/components/common/…`.

---

## `components/ui` — primitives

### Actions

**`Button`** — `variant` `primary` | `danger` | `secondary` · `size` `sm` | `md` ·
`icon` · `loading`

Le point important : **si `onClick` renvoie une promesse, le bouton se gère
seul**. `useClickBusy` affiche le spinner, verrouille contre la réentrance
(double-clic, Entrée maintenue) et rend la main à la résolution. Ne pas câbler un
`loading` externe pour ça, ne pas ajouter de `isSubmitting` maison.

```tsx
<Button icon={<Save className="h-4 w-4" />} onClick={async () => { await save(); }}>
  Enregistrer
</Button>
```

Dimensionner l'icône selon la taille : `h-4 w-4` (md), `h-3.5 w-3.5` (sm).

**`IconButton`** — `icon` (requis) · `variant` `default`|`edit`|`view`|`info`|
`delete`|`secondary`|`ghost` · `loading`

Bouton plein carré à icône seule, format des actions de tableau Laravel. Même
protection anti-réentrance que `Button`. `ghost` est réservé aux affordances
discrètes (chevron, fermeture) — pas aux actions CRUD.

Toujours poser un `title` : il alimente l'infobulle Hyper globale (`HyperTooltip`).

### Saisie

**`FormField`** — `label` · `error` · `required` · `hint` · `children`

Enveloppe label + champ + message d'erreur. C'est le conteneur standard d'un
champ de formulaire ; le champ lui-même est passé en enfant.

**`TextInput`** — props natives `<input>` + `error?: boolean` · `ref`
Compatible `register()` de react-hook-form (React 19 transmet `ref` en prop).

**`INPUT_CLASS`** (`@/lib/ui/inputClass`) — la classe de champ, en constante.

Pour un `<input>` natif dans un `FormField` (le motif dominant du repo), importer
la constante sous alias local plutôt que de recopier la chaîne :

```ts
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
```

Elle a remplacé ~43 déclarations locales qui avaient divergé (`shadow-sm` absent
ici, `disabled:*` manquant là). Les états `disabled:` et `read-only:` y sont
inclus et restent inertes tant que l'attribut n'est pas posé.

**`Checkbox`** — props natives + `label` · `ref` — case bleue + coche animée.

**`SearchInput`** — props natives + `className` sur le conteneur. Loupe intégrée,
placeholder par défaut « Rechercher... ».

**`FormToggle`** — `label` · `checked` · `onChange(checked)` · `hint` · `disabled`

**`FormFileUpload`** — `onChange(FileList | null)` · `accept` · `multiple` ·
`label` · `error` · `hint`

**`RichTextEditor`** — éditeur « Word-like » des comptes rendus. Le rendu HTML est
stylé par `.rte-content` dans `globals.css`.

**`SignaturePad`** (dans `common/`) — capture de signature manuscrite.

### Sélection

Quatre composants, à ne pas confondre :

| Composant | Quand |
|---|---|
| `NativeSelect` | `<select>` natif stylé (`appearance: base-select`). Listes courtes et fixes. |
| `FormSelect` | react-select contrôlé. `value`/`onChange`, `isMulti` discriminé par type. Liste **préchargée**. |
| `SelectField` / `CreatableSelectField` | react-select avec création d'option à la volée. |
| `RemoteSelectField` / `RemoteMultiSelectField` | `loadOptions(input) => Promise<Option[]>` — recherche **côté serveur**. |
| `RHFSelect` / `RHFCreatableSelect` | variantes câblées sur `Controller` de react-hook-form. |
| `LimitedSelect` | select plafonné en nombre de sélections. |

Règle de choix : dès que la collection peut dépasser quelques dizaines
d'éléments, **`RemoteSelectField`**. Le menu n'affiche que 6 options sans
défilement (règle CSS globale) : sans recherche serveur, un élément au-delà du
6ᵉ devient inatteignable.

### Affichage

**`PageHeader`** — `title` · `subtitle` · `breadcrumbs` · `action` · `sticky`
(défaut `true`)

En-tête de page standard : fil d'Ariane, titre 18px, slot d'action à droite.
Le mode collant utilise `-top-6 / -mx-6 / -mt-6` pour couvrir le padding `p-6`
du `<main>` avec un fond opaque — ne pas modifier ces valeurs sans ajuster le
layout, sinon du texte défile dans l'espace laissé libre.

**`Badge`** — `variant` `success`|`warning`|`danger`|`info`|`primary`|`secondary`
Style « lighten » Hyper (fond 18 %, texte plein).

**`StatusBadge`** — `status` · `domain` `invoice`|`report`|`testOrder`|`contract`|
`general`

Traduit un statut brut de l'API en libellé + variante. Lookup exact, puis
insensible à la casse, puis repli `secondary` avec le statut brut. **Ajouter un
statut ici**, pas dans la page.

**`StatCard`** — `title` · `value` · `icon` · `trend {value, isPositive}`
**`KpiCard`** (dans `dashboard/`) — variante tableau de bord.

**`AlertBox`** — `type` `success`|`error`|`warning`|`info` · `title` · `message` ·
`onDismiss`

Pour un message **persistant dans la page**. Pour un retour d'action ponctuel,
utiliser `toast` de sonner à la place.

**`AppLogo`** — `surface` `light`|`dark` · `fallback` `name`|`initial`

Logo du laboratoire, alimenté par les Paramètres (`setting_apps.logo`) via
`useBranding()`. Fonctionne **avant connexion** (route publique
`/public/branding`). Ne jamais écrire `<img src="/logo.png">`.

---

## `components/common` — assemblages

**`DataTable<T>`** — `columns` (TanStack `ColumnDef[]`) · `data` · `isLoading` ·
`rowClassName` · `title` · `hideToolbar` · `hideToolbarSearch`

Pagination : **serveur si `pageCount` est fourni** (avec `pageIndex`, `pageSize`,
`onPageChange`, `onPageSizeChange`), locale sinon. Oublier `pageCount` sur une
API paginée est le bug classique : le tableau n'affiche que la première page en
croyant tout détenir.

Recherche : `searchValue` / `onSearchChange`. Si la page a déjà son propre
`SearchInput`, passer `hideToolbarSearch` — deux champs de recherche sur un même
écran est une non-conformité.

**`DataTableCard<T>`** — mêmes props que `DataTable` + `filters?: ReactNode`.
Carte standard englobant filtres + tableau. À préférer au wrapper manuscrit.

**`TablePagination`** — `TableLengthControl` + `TablePaginationFooter`, déjà
utilisés par `DataTable`.

**`CrudModal`** — `isOpen` · `onClose` · `title` · `size` `sm`…`2xl` ·
`onSubmit` · `submitLabel` · `footer` · `contentClassName`

`onSubmit` asynchrone ⇒ le bouton se verrouille jusqu'à résolution.

**`ConfirmModal`** — `isOpen` · `onClose` · `onConfirm` · `title` · `message` ·
`confirmVariant` `danger`|`primary`

Toute action destructive passe par là.

**`RowActions`** — `onEdit` · `onDelete` · `editPermission` · `deletePermission` ·
`editLabel` · `deleteLabel` · `iconOnly` (défaut **`true`**)

Actions de ligne conformes Laravel : icônes seules, chacune sous son
`PermissionGate` si une permission est fournie. Ne pas repasser `iconOnly={false}`
sans raison documentée.

**`PermissionGate`** — `permission` (une ou un tableau) · `mode` `any`|`all` ·
`fallback`

**`AuthGuard`** — enveloppe le groupe `(dashboard)`. Ne pas dupliquer dans une page.

**`HyperTooltip`** — monté une fois dans le layout dashboard. Affiche une infobulle
Hyper au survol de **tout élément portant un `title`**. C'est pourquoi les
`IconButton` doivent porter un `title` plutôt qu'un `aria-label` seul.

**`AutoPlaceholders`** — pose automatiquement les placeholders sur les champs.

---

## Ce que le kit ne couvre pas

Créer un nouveau composant est légitime quand :

- l'écran Laravel a un widget sans équivalent ici (le porter dans `components/ui`
  ou `components/common`, pas dans la page) ;
- un motif se répète dans **trois** pages ou plus.

Dans les deux cas : commentaire d'en-tête expliquant le *pourquoi* (le repo le
fait systématiquement, en français), export ajouté au barrel `index.ts`.
