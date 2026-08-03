---
name: senior-frontend
description: Système de design et standard front-end du projet labo-anapath (Next 16 / React 19 / Tailwind v4, palette « Ardoise & Azur »). À charger avant d'écrire ou de modifier une page, un composant, un style ou un graphique dans labo-anapath-frontend, et pour auditer la conformité visuelle d'un écran existant.
---

# Standard front-end — labo-anapath

Ce skill décrit **ce repo**, pas React en général. Les valeurs qu'il donne sont
relevées dans le code ; les chiffres sont exacts, pas indicatifs.

## La règle qui prime sur toutes les autres

**Le système de design de ce repo fait autorité — plus le thème Hyper de
Laravel.** Décision du propriétaire du produit (3 août 2026) : l'application a
son identité propre, la palette « Ardoise & Azur », pensée pour un logiciel
médical contemporain. Le Blade Laravel reste la référence **fonctionnelle**, il
n'est plus la référence **visuelle**.

Ce que ça implique, concrètement :

- **Structure, données, libellés → toujours le Blade.** Avant de coder un écran,
  lire `labo-anapath-main/resources/views/` : colonnes de tableau, ordre des
  champs, intitulés, règles métier. Un écart là-dessus reste un bug.
- **Couleurs, formes, espacements, élévation → ce skill.** Ne jamais recopier
  une valeur de `app.min.css`. Les anciens repères (angles à `.15rem`, ombre
  diffuse de 35px, badges à 18 % d'opacité, en-têtes en majuscules) sont
  volontairement abandonnés.
- **Le levier est la couche de tokens, pas les pages.** `globals.css` remappe
  les échelles Tailwind : changer un token repeint les 84 écrans. Retoucher une
  page pour corriger une couleur est presque toujours le mauvais geste — c'est
  le token qu'il faut corriger.
- Improviser une esthétique par écran reste hors périmètre. Le travail consiste
  à **étendre le système**, pas à en ouvrir un second.

## Pile réelle

| Rôle | Choix | Version |
|---|---|---|
| Framework | Next.js **App Router** | 16.2.11 |
| React | React (Server + Client Components) | 19.2.4 |
| Styles | Tailwind **v4** (`@import "tailwindcss"`, `@theme`) | — |
| Données serveur | TanStack Query | v5 |
| Tableaux | TanStack Table | v8 |
| Formulaires | react-hook-form + zod v4 + `@hookform/resolvers` | — |
| HTTP | axios (`src/lib/api/client.ts`) | — |
| État client | zustand (`auth` / `branch` / `ui`) | v5 |
| Icônes | lucide-react | — |
| Notifications | sonner (`toast.success` / `toast.error`) | — |
| Selects riches | react-select (`classNamePrefix="react-select"`) | — |

Commandes : `npm run dev` (port **3001**), `npm run build`, `npm run lint`
(`eslint`, sans argument). Vérification de types : `npx tsc --noEmit`.

> ⚠️ **Next 16 n'est pas le Next de ta mémoire d'entraînement.** L'`AGENTS.md`
> du repo l'impose : consulter `node_modules/next/dist/docs/` (`01-app/`) avant
> d'écrire du code qui touche au routage, aux params, au caching ou aux Server
> Actions. Les signatures ont changé (params asynchrones, etc.).

## Arborescence

```
src/
├── app/
│   ├── (auth)/          login, forgot-password, reset-password, 2fa, select-branch
│   ├── (dashboard)/     84 pages métier, sous AuthGuard + coque Sidebar/Topbar/Footer
│   ├── globals.css      couche de tokens (palette, rayons, élévation) + .hyper-*
│   └── layout.tsx       Nunito (next/font), <Providers>, translate="no"
├── components/
│   ├── ui/              kit de base — cf. references/ui-kit.md
│   ├── common/          DataTable, CrudModal, ConfirmModal, PermissionGate, RowActions…
│   ├── layout/          sidebar, topbar, footer, AppSettingsEffects
│   ├── dashboard/ hr/ examens/
├── hooks/               usePermissions, useBranding, useCurrentUser, useHydrated…
├── lib/api/             un module par domaine + client.ts (axios)
├── lib/constants/       permissions.ts, report.ts
└── stores/              auth.store, branch.store, ui.store (zustand)
```

## Les six règles de conformité

Ce sont les points à vérifier sur tout écran, existant ou nouveau. Le script
`scripts/audit_ui_conformity.py` les contrôle mécaniquement.

### 1. Aucune couleur en dur hors tokens

`globals.css` remappe les échelles Tailwind vers la palette du système. Écrire
`bg-blue-600` **donne** l'azur `#2e4bd8`. Il ne faut donc jamais écrire la valeur
hexa directement dans une page.

```tsx
// ✗ contourne le remap : la couleur ne suivra pas une évolution de la palette
<div className="bg-[#2e4bd8] text-[#dc2848]">

// ✓ passe par les tokens
<div className="bg-blue-600 text-red-600">
```

Exception admise : les `rgba()` des ombres teintées de survol, qui n'ont pas
d'équivalent en classe Tailwind — et qui ne vivent que dans `components/ui`, où
le kit *implémente* les tokens.

Quand une couleur n'a pas de token, **en créer un** dans le bloc `@theme` de
`globals.css` plutôt que de répéter l'hexa. C'est ce qui a été fait pour le menu
latéral : `--color-sidebar-link` / `--color-sidebar-link-hover` donnent
`text-sidebar-link` / `hover:text-sidebar-link-hover`.

### 1 bis. Une seule classe de champ pour toute l'application

`INPUT_CLASS` (`src/lib/ui/inputClass.ts`) est la source unique du style des
champs de saisie. Une quarantaine d'écrans l'importent sous alias local :

```ts
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
```

Ne pas redéclarer de `const inputClass = "w-full rounded-lg border …"` dans une
page : c'est exactement la duplication qui avait fait diverger les formulaires
d'un écran à l'autre. `.hyper-form-control` reste acceptable — c'est la même
définition, portée par CSS plutôt que par classes utilitaires.

### 2. Le kit UI avant le HTML brut

Un `<button>`, `<input>` ou `<select>` nu dans une page est une régression : il
rate le style du système, l'anti-double-clic, l'état d'erreur et l'accessibilité.

| Au lieu de | Utiliser |
|---|---|
| `<button>` | `Button` (`primary` / `danger` / `secondary`, `sm` / `md`) |
| bouton d'action de ligne | `IconButton` (icône seule) ou `RowActions` |
| `<input>` + label + erreur | `FormField` (RHF) ou `TextInput` |
| classe de champ locale | `INPUT_CLASS` de `@/lib/ui/inputClass` |
| `<select>` | `FormSelect` / `NativeSelect` / `SelectField` |
| tableau `<table>` | `DataTable` (TanStack) dans `DataTableCard` |
| titre de page | `PageHeader` (titre + fil d'Ariane + slot action) |
| statut métier | `StatusBadge` (mappe le statut au libellé + variante) |
| confirmation destructive | `ConfirmModal` |
| création/édition | `CrudModal` |
| logo du labo | `AppLogo` (jamais `<img src="/logo.png">`) |

### 3. Les actions de ligne sont des icônes seules

Dans un tableau, `Modifier` / `Supprimer` sont des pastilles carrées de 32px ne
contenant qu'une icône — fond teinté au repos, plein au survol. `RowActions` le
fait par défaut (`iconOnly = true`) et pose le `title` qui alimente l'infobulle
globale. Ne pas ré-afficher les libellés : trois libellés par ligne sur des
dizaines de lignes noient la donnée.

### 4. Chaque action sensible passe par une permission

```tsx
<PermissionGate permission="edit-users">
  <Button onClick={…}>Modifier</Button>
</PermissionGate>
```

`usePermissions()` n'évalue rien avant hydratation (`useHydrated`) : le store est
persisté, et évaluer trop tôt casserait la concordance SSR/client. Ne jamais lire
`useAuthStore().hasPermission` directement dans un rendu.

### 5. Forme, profondeur et typographie du système

Détail complet dans `references/design-system.md`.

- corps de texte **0.9rem**, couleur **#475569** (`text-gray-600`)
- titre de page **1.25rem** semibold, interlettrage `-0.015em` (`PageHeader`)
- en-tête de carte **0.9375rem / 600**, casse normale → `.hyper-card-heading`
- carte → `.hyper-card` (rayon **0.75rem**, élévation plate) + `.hyper-card-body`
- contrôles (boutons, champs, badges) → rayon **0.5rem** (`--radius-control`)
- espace entre groupes de champs → `.hyper-field` (**1.5rem**)
- élévation → `--elevation-flat` / `-raised` / `-overlay`, jamais une ombre
  inventée sur place

### 6. Les couleurs de graphique passent par `chartColors.ts`

recharts reçoit ses couleurs en props JavaScript : elles échappent au remap
Tailwind. `src/lib/ui/chartColors.ts` est leur source unique.

- séries d'**identité** → `CHART_CATEGORICAL`, dans l'ordre, jamais réordonné
- séries d'**état** (payé/impayé, terminé/en attente) → `CHART_STATUS`
- grille → `CHART_GRID`

L'ordre de `CHART_CATEGORICAL` a été validé par script (bande de luminosité,
chroma, séparation sous déficience de vision des couleurs, contraste). Toute
modification doit être revalidée — la commande est dans l'en-tête du fichier.

## Écrire une page de liste

Le squelette que suivent les pages conformes du repo :

```tsx
"use client";

export default function ThingsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["things", page, search],
    queryFn: () => thingsApi.list({ page, search }),
  });

  const columns = useMemo<ColumnDef<Thing>[]>(() => [
    { accessorKey: "code", header: "Code" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          onEdit={() => openEdit(row.original)}
          onDelete={() => confirmDelete(row.original)}
          editPermission="edit-things"
          deletePermission="delete-things"
        />
      ),
    },
  ], []);

  return (
    <>
      <PageHeader
        title="Choses"
        breadcrumbs={[{ label: "Accueil", href: "/home" }, { label: "Choses" }]}
        action={
          <PermissionGate permission="create-things">
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Ajouter
            </Button>
          </PermissionGate>
        }
      />
      <DataTableCard>
        <DataTable
          columns={columns}
          data={data?.content ?? []}
          pageCount={data?.totalPages}
          pageIndex={page}
          onPageChange={setPage}
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={isLoading}
        />
      </DataTableCard>
    </>
  );
}
```

Points d'attention :

- `pageCount` défini ⇒ `DataTable` bascule en pagination **serveur**. L'omettre
  avec un jeu de données paginé côté API n'affiche qu'une seule page.
- Une seule recherche par écran : si la page fournit son propre `SearchInput`,
  passer `hideToolbarSearch`.
- `Button` gère seul son spinner quand le `onClick` est `async` — ne pas câbler
  un `loading` manuel, et ne pas ajouter de garde anti-double-clic (déjà dans
  `useClickBusy`).

## Références

- `references/design-system.md` — palette, tokens, classes `.hyper-*`,
  correspondance Bootstrap → Tailwind, pièges du remap.
- `references/ui-kit.md` — les composants de `components/ui` et
  `components/common` : signature, quand les utiliser, quand ne pas les utiliser.
- `references/data-and-permissions.md` — TanStack Query, `apiClient`, en-tête
  `X-Branch-Id`, permissions, formulaires RHF + zod, et les écarts Next 16.

## Audit de conformité

```bash
# Tout le repo
python3 .claude/skills/senior-frontend/scripts/audit_ui_conformity.py src

# Un écran précis, avec le détail ligne à ligne
python3 .claude/skills/senior-frontend/scripts/audit_ui_conformity.py \
  "src/app/(dashboard)/contracts" --verbose
```

Le script signale : couleurs hexa hors tokens, `<button>`/`<input>`/`<select>`
bruts, `<table>` manuscrits, pages sans `PageHeader`, actions de ligne avec
libellé, `hasPermission` lu hors `usePermissions`, et `<img>` de logo figé.
Il sort en code 1 s'il trouve au moins une violation de sévérité `high`, ce qui
permet de le brancher en pre-commit.

**C'est une heuristique ligne à ligne, pas un analyseur syntaxique.** Elle ne
distingue pas un `<button>` stylé en lien (cellule cliquable, légitime) d'un vrai
bouton, ni un `<table>` de mise en page statique — fidèle au Blade — d'une liste
qui devrait passer par `DataTable`. Les résultats `medium` se lisent, ils ne
s'appliquent pas mécaniquement : **vérifier le Blade Laravel avant de convertir**.
Les `high` (couleur hors token, champ hors design system, logo figé) sont en
revanche des corrections sûres.
