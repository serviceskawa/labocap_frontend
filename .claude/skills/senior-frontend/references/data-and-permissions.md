# Données, permissions, formulaires

## `apiClient` (`src/lib/api/client.ts`)

Instance axios unique. Base : `NEXT_PUBLIC_API_URL` (défaut
`http://localhost:8080/api/v1`), `withCredentials: true` — l'authentification
repose sur des cookies HttpOnly, **aucun token n'est stocké côté navigateur**.

Trois comportements automatiques à connaître avant d'appeler l'API :

### 1. Déballage de l'enveloppe

Le backend Java répond `{ success, message, data, timestamp }`. L'intercepteur de
réponse remplace `response.data` par `response.data.data`. Côté front, on lit donc
directement la charge utile :

```ts
const res = await apiClient.get<PageResponse<Thing>>("/things");
res.data.content   // ✓  — et non res.data.data.content
```

### 2. En-tête `X-Branch-Id`

Posé sur chaque requête depuis le cookie de branche. C'est l'équivalent stateless
du `selected_branch_id` de session Laravel : le backend le **revalide** contre
`branch_user` et substitue la branche du principal, ce qui isole toute la donnée
sur la branche active.

Un **428** signifie « branche non sélectionnée ou accès révoqué » : l'intercepteur
efface la branche et redirige vers `/select-branch`. Ne pas traiter le 428 comme
une erreur métier dans une page.

### 3. Rafraîchissement sur 401

Un 401 déclenche `POST /auth/refresh` puis rejoue la requête, avec file d'attente
pour les appels concurrents. Les routes du flux d'authentification en sont
exclues (`noRefreshPaths`) — un 401 y est une vraie erreur d'identifiants.

**Conséquence :** un appel non authentifié volontaire (page de login) ne doit pas
passer par `apiClient`, sous peine de déclencher un refresh puis une redirection
vers `/login` depuis `/login`. C'est pourquoi `lib/api/branding.ts` utilise une
instance axios nue.

### Écrire un module d'API

Un fichier par domaine dans `src/lib/api/`, exportant un objet :

```ts
export const thingsApi = {
  list: (params: ListParams) => apiClient.get<PageResponse<Thing>>("/things", { params }),
  getById: (id: string) => apiClient.get<Thing>(`/things/${id}`),
  create: (dto: ThingRequest) => apiClient.post<Thing>("/things", dto),
  update: (id: string, dto: ThingRequest) => apiClient.put<Thing>(`/things/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/things/${id}`),
};
```

Fichiers utiles : `fileUrl(path)` construit l'URL absolue d'un fichier servi par
le backend (`/api/v1/files/...`). Un chemin relatif viserait le serveur Next
(port 3001) → 404.

## TanStack Query

Défauts posés dans `components/providers.tsx` : `staleTime` **30 s**, `retry` 1,
`refetchOnWindowFocus` **false**.

Conventions :

- Clé = `[domaine, ...paramètres]` — `["things", page, search]`. Tout paramètre
  qui change le résultat doit figurer dans la clé.
- Données lourdes et rarement modifiées (logos, réglages) : remonter `staleTime`
  et `gcTime` explicitement, comme `useAppSettings` (5 min / 30 min) et
  `useBranding`.
- Une requête dont l'échec est normal (403 attendu) : `retry: false`, et
  l'appelant retombe sur ses valeurs par défaut.
- Après mutation : `queryClient.invalidateQueries({ queryKey: ["things"] })`.

## Permissions

Catalogue typé dans `src/lib/constants/permissions.ts` (~210 lignes) :
`PERMISSIONS.EDIT_PATIENTS === "edit-patients"`. Le type `Permission` en dérive —
une chaîne inconnue est une erreur de compilation.

Deux points d'entrée, jamais le store directement :

```tsx
// Rendu conditionnel
<PermissionGate permission="delete-users">…</PermissionGate>
<PermissionGate permission={["edit-users", "view-users"]} mode="all">…</PermissionGate>

// Logique
const { can, canAny, canAll } = usePermissions();
if (can("validate-reports")) { … }
```

`usePermissions` passe par `useHydrated()` : tant que zustand n'a pas réhydraté le
store persisté, **tout renvoie `false`**. C'est délibéré — évaluer avant
hydratation produirait un rendu serveur différent du premier rendu client. Ne
jamais contourner en lisant `useAuthStore().hasPermission` dans un composant.

Rappel : une permission côté front **masque**, elle ne protège pas. Le backend
garde chaque route par `@PreAuthorize`.

## Stores zustand

| Store | Contenu |
|---|---|
| `auth.store` | utilisateur courant, permissions, `hasPermission` / `hasAnyPermission`, `clearAuth` (persisté) |
| `branch.store` | branche active, `clearBranch` |
| `ui.store` | `sidebarCollapsed`, `mobileSidebarOpen`, `toggleSidebar`, `toggleMobileSidebar` |

Les données **serveur** vivent dans TanStack Query, pas dans zustand. Un store ne
contient que de l'état client (session, préférences d'affichage).

## Formulaires

react-hook-form + zod v4, résolveur `@hookform/resolvers/zod`. Les messages de
validation sont en français via `@/lib/zod-locale`, importé dans `Providers`
(composant client, pour que la locale s'applique aussi dans le bundle navigateur).

```tsx
const schema = z.object({
  email: z.string().min(1, "L'adresse e-mail est requise").email("Format d'e-mail invalide"),
});
type FormData = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
});

<FormField label="Adresse e-mail" required error={errors.email?.message}>
  <TextInput {...register("email")} error={!!errors.email} />
</FormField>
```

- Messages d'erreur **en français**, formulés comme dans Laravel.
- `noValidate` sur le `<form>` : la validation est celle de zod, pas celle du
  navigateur (dont les messages sont dans la langue du navigateur).
- Retour d'action : `toast.success(…)` / `toast.error(…)` (sonner, positionné
  en haut à droite, `richColors`).

## Next 16 — écarts à vérifier

`AGENTS.md` l'impose : **lire `node_modules/next/dist/docs/01-app/` avant** de
toucher au routage, aux paramètres de route, au caching ou aux Server Actions.
Cette version comporte des ruptures par rapport aux habitudes de l'App Router
antérieur, et les signatures mémorisées sont probablement périmées.

Ce qui est établi dans ce repo :

- App Router avec groupes `(auth)` / `(dashboard)`, `output: "standalone"`.
- Presque tous les écrans sont des **Client Components** (`"use client"`) : ils
  dépendent de zustand, TanStack Query et du cookie de branche.
- Police via `next/font/google` — auto-hébergée au build.
- `next/image` n'est **pas** utilisé pour les logos : ce sont des data-URI issues
  des Paramètres, il n'y a rien à optimiser et l'optimiseur runtime serait un
  coût pur. Le `eslint-disable @next/next/no-img-element` associé est volontaire.
- `translate="no"` sur `<html>` : la traduction automatique de Chrome réécrit les
  nœuds texte et provoque `Cannot read properties of null (reading 'removeChild')`
  sur une application React francophone.
