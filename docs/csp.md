# Content Security Policy

Protection contre l'injection de code (XSS) et le chargement de ressources non
autorisées. La politique est posée par le proxy, avec un nonce régénéré à chaque
requête.

| Fichier | Rôle |
|---|---|
| [`src/lib/security/csp.ts`](../src/lib/security/csp.ts) | Politique, directive par directive — source unique de vérité |
| [`src/proxy.ts`](../src/proxy.ts) | Génère le nonce, pose les en-têtes sur chaque réponse |
| [`src/app/api/csp-report/route.ts`](../src/app/api/csp-report/route.ts) | Collecte les violations |
| [`src/app/layout.tsx`](../src/app/layout.tsx) | Relaie le nonce à Emotion et à styled-jsx |
| [`scripts/check-csp-hashes.mjs`](../scripts/check-csp-hashes.mjs) | Garde-fou contre la dérive des hashes |

## 1. Inventaire des ressources

L'application ne charge **aucune ressource tierce** : pas d'analytics, pas de SDK
de paiement, pas de police distante. `next/font/google` télécharge Nunito au
build et la sert depuis `self`. La seule origine externe est l'API backend.

| Origine | Usage | Directive |
|---|---|---|
| `'self'` | bundles Next.js, CSS Tailwind compilé, polices Nunito auto-hébergées | `script-src`, `style-src-elem`, `font-src` |
| API backend (`NEXT_PUBLIC_API_URL`) | appels axios, logo de l'établissement, pièces jointes | `connect-src`, `img-src` |
| `data:` | QR codes des factures (base64), signatures capturées au canvas | `img-src`, `font-src` |
| `blob:` | aperçus PDF, miniatures récupérées via axios | `img-src`, `media-src` |

L'origine de l'API est **déduite automatiquement** de `NEXT_PUBLIC_API_URL` : il
n'y a aucun domaine codé en dur à maintenir.

## 2. Code inline : statique ou dynamique ?

Aucun `<script>` inline n'existe dans le code applicatif. Les blocs inline
proviennent tous du framework ou de librairies, et sont classés ainsi :

| Bloc | Nature | Traitement |
|---|---|---|
| Scripts Next.js (runtime React, chunks, flight data) | dynamique | **nonce** — apposé automatiquement par Next.js, qui relit la politique dans l'en-tête de requête |
| Styles Emotion (react-select, 23 écrans) | dynamique | **nonce** — via le `NonceProvider` de react-select ([`providers.tsx`](../src/components/providers.tsx)) |
| Styles styled-jsx (feuille de route imprimable) | dynamique | **nonce** — lu dans `<meta property="csp-nonce">`, seul canal que styled-jsx sait lire |
| CSS de sonner | **statique** | **hash SHA-256** — la librairie n'accepte aucun nonce |
| Attributs `style="…"` (Radix UI, recharts) | dynamique | `style-src-attr 'unsafe-inline'` — voir ci-dessous |

Nonce et hash ne sont jamais combinés à `'unsafe-inline'` dans une même
directive : `style-src-attr` est une directive distincte, qui ne s'applique
qu'aux attributs et n'affaiblit pas `style-src-elem`.

### Pourquoi `style-src-attr 'unsafe-inline'`

Ni un nonce ni un hash ne peuvent autoriser un attribut `style="…"` — la
spécification CSP ne le permet pas, seul `'unsafe-inline'` le peut. Or Radix UI
en produit en continu (positionnement des popovers, menus, tooltips) et recharts
en pose sur chaque élément SVG. La directive est donc nécessaire, mais son
périmètre est limité aux seuls attributs : les balises `<style>` restent
contrôlées par `style-src-elem` en nonce + hash.

`style-src` ne subsiste que comme repli pour les navigateurs antérieurs à
`style-src-elem`/`-attr` (Safari < 15.4) ; les navigateurs modernes l'ignorent.

## 3. Déploiement : observer puis bloquer

La politique est posée **en `Report-Only` par défaut**. Rien n'est bloqué : les
violations sont simplement remontées à `/api/csp-report` et journalisées
(`[csp-violation]` dans les logs du conteneur).

```bash
docker compose logs -f frontend | grep csp-violation
```

Bascule en mode bloquant une fois les violations résiduelles nulles ou
explicitement acceptées :

```bash
CSP_ENFORCE=true docker compose up -d frontend
```

`CSP_ENFORCE` est lue **au runtime** : la bascule ne nécessite aucune
reconstruction d'image, et le retour arrière est immédiat.

> Corriger le code plutôt qu'élargir la politique. Une directive qu'on élargit
> pour faire taire une violation annule le bénéfice de la CSP.

## 4. Vérification avant bascule

La politique stricte ne vaut qu'en production : `npm run dev` relâche
`'unsafe-eval'` (React reconstruit les stacks serveur par `eval`) et
`'unsafe-inline'` sur les styles (le HMR réinjecte le CSS sans nonce). **Toute
vérification doit se faire sur un build de production** :

```bash
npm run build && npm run start
```

Parcours à exercer, console ouverte, avant de passer en mode bloquant :

- [ ] **Aperçu PDF** — facture, rapport, bulletin de paie ouverts dans un nouvel
      onglet. *Point de vigilance principal* : ces documents sont servis en
      `blob:` et **héritent de la CSP de la page qui les ouvre**. Si le
      visualiseur PDF du navigateur remonte une violation `object-src`, passer
      cette directive à `blob:` — et à elle seule.
- [ ] **Sélecteurs** (react-select) — un écran de création (commande d'analyse,
      facture) : les listes déroulantes doivent rester stylées. Sinon, le nonce
      n'atteint pas Emotion.
- [ ] **Toasts** (sonner) — déclencher une erreur : un toast non stylé signale un
      hash désynchronisé (`npm run csp:hashes`).
- [ ] **Impression** — feuille de route d'une assignation : la mise en page
      d'impression dépend de styled-jsx et donc de la balise `<meta csp-nonce>`.
- [ ] **Popovers, menus, tooltips** (Radix) — positionnement correct.
- [ ] **Authentification** — connexion, challenge 2FA, sélection de branche,
      réinitialisation de mot de passe.
- [ ] **Graphiques** (recharts) sur le tableau de bord.
- [ ] **Téléversements et signatures** — capture au canvas, miniatures.

Valider enfin la politique produite sur
[CSP Evaluator](https://csp-evaluator.withgoogle.com) : copier la valeur de
l'en-tête `Content-Security-Policy` d'une réponse réelle.

```bash
curl -sI https://<host>/login | grep -i content-security-policy
```

## 5. Maintenance

À intégrer à la Definition of Done, aux côtés d'OSV-Scanner :

- **Toute nouvelle dépendance front ou tout script tiers** impose de revoir la
  politique — une librairie qui injecte des `<style>` ou charge une ressource
  distante ajoute une origine à déclarer explicitement.
- **Après tout `npm update`**, lancer `npm run csp:hashes`. Le CSS de sonner
  change à chaque version : le script échoue si le hash a dérivé et le corrige
  avec `--fix`. Sans ce contrôle, la régression est invisible en `Report-Only`
  et purement visuelle en mode bloquant.
- **Après toute montée de version majeure de Next.js**, revérifier que les
  scripts internes du framework portent bien le nonce :

  ```bash
  curl -s https://<host>/login | grep -c '<script'          # total
  curl -s https://<host>/login | grep '<script' | grep -vc nonce=   # doit valoir 0
  ```

- **Revue périodique** même sans changement connu.

## Annexe — conséquence sur le rendu

Le layout racine lit `headers()` pour relayer le nonce : toutes les routes
passent donc en rendu dynamique. Sans impact ici, l'application étant
entièrement authentifiée et donc jamais mise en cache par un CDN.

`upgrade-insecure-requests` n'est émise que si l'API est en `https` : sur un
déploiement où `NEXT_PUBLIC_API_URL` reste en `http`, la directive casserait
tous les appels API.
