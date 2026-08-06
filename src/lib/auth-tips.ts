/**
 * Conseils de sécurité du panneau d'authentification.
 *
 * ## Pourquoi un conseil par jour, et pas un carrousel
 *
 * Un carrousel qui défile tout seul oblige à attendre pour lire, et personne
 * n'attend sur un écran de connexion — on tape son mot de passe. Un conseil
 * fixe, lui, devient invisible en une semaine : c'est le sort de tous les
 * bandeaux permanents.
 *
 * Le tirage quotidien garde la fraîcheur sans exiger d'attention : celui qui se
 * connecte trois fois dans la journée voit le même texte et n'est pas dérangé,
 * celui qui revient demain en découvre un autre.
 *
 * ## Pourquoi le tirage se fait côté serveur
 *
 * L'index est dérivé de la date. Calculé des deux côtés, il diverge pendant la
 * seconde qui entoure minuit UTC — assez pour provoquer une erreur
 * d'hydratation React. Le layout `(auth)` est un composant serveur : il tire,
 * et transmet. Cf. {@link https://react.dev/reference/react-dom/client/hydrateRoot}
 *
 * ## Pourquoi une permutation plutôt qu'un tirage
 *
 * `jour % 7` fait défiler les conseils dans l'ordre : au bout d'une semaine le
 * suivant est prévisible. Un simple hachage de la date corrige cela mais tire
 * chaque jour indépendamment — mesuré sur 28 jours, il ressortait deux fois le
 * même conseil deux jours de suite, et laissait des conseils sortir six fois
 * quand d'autres n'en sortaient que deux.
 *
 * On brasse donc le jeu entier par cycles de sept jours : chaque conseil passe
 * exactement une fois par cycle, dans un ordre différent à chaque cycle, et la
 * jointure entre deux cycles est corrigée pour qu'aucun ne revienne le
 * lendemain de lui-même.
 */
export interface AuthTip {
  /** Affirmation, en une phrase. C'est elle qu'on lit ; le reste développe. */
  titre: string;
  /** Deux phrases au plus — le panneau n'est pas une notice. */
  corps: string;
}

/**
 * Conseils généraux, tirés au sort chaque jour.
 *
 * Écrits pour un laboratoire d'anatomopathologie au Bénin : ils nomment des
 * situations réelles du poste — la paillasse, le compte rendu, le proche qui
 * téléphone — plutôt que des généralités sur la sécurité informatique, qu'on
 * ne lit pas parce qu'on les a déjà lues ailleurs.
 */
export const AUTH_TIPS: readonly AuthTip[] = [
  {
    titre: "Les données de santé sont des données sensibles.",
    corps:
      "Le Code du numérique du Bénin (loi n° 2017-20) leur impose une protection renforcée. N'y accédez que pour les patients dont vous avez la charge.",
  },
  {
    titre: "Verrouillez le poste en quittant la paillasse.",
    corps:
      "Une session laissée ouverte donne accès aux dossiers de tous les patients de la branche, pas seulement à ceux que vous traitez.",
  },
  {
    titre: "Un compte ne se prête pas, même entre collègues.",
    corps:
      "Chaque action est enregistrée au nom de son auteur. Prêter ses identifiants, c'est endosser ce qu'un autre en fera.",
  },
  {
    titre: "AnapathLab ne vous demandera jamais votre mot de passe.",
    corps:
      "Un message qui réclame vos identifiants ou un code de connexion ne vient pas du laboratoire, quelle que soit son apparence.",
  },
  {
    titre: "Un résultat se remet au patient, pas à son entourage.",
    corps:
      "Le secret médical ne connaît pas d'exception de courtoisie. Ni pour un proche insistant, ni au téléphone.",
  },
  {
    titre: "Un dossier consulté laisse une trace.",
    corps:
      "L'historique des accès est conservé. Il protège le patient, et il vous protège en cas de contestation.",
  },
  {
    titre: "Vérifiez l'identité du prélèvement avant de valider.",
    corps:
      "Un compte rendu signé engage le laboratoire. Une inversion se rattrape mal une fois le résultat notifié.",
  },
];

/**
 * Conseil de l'écran de vérification en deux étapes — fixe, et non tiré au sort.
 *
 * C'est le seul moment de l'application où une menace précise est active :
 * quelqu'un qui détient déjà le mot de passe appelle l'utilisateur pour lui
 * réclamer le code qu'il vient de recevoir. Y afficher un conseil général sur
 * le secret médical gâcherait le seul endroit où l'avertissement porte.
 */
export const OTP_TIP: AuthTip = {
  titre: "Ce code est strictement personnel.",
  corps:
    "Ne le communiquez à personne — l'équipe AnapathLab ne vous le demandera jamais, ni par téléphone ni par e-mail.",
};

/**
 * Indice du conseil du jour.
 *
 * @param now instant de référence. Injectable pour les tests ; le layout passe
 *   simplement `new Date()`.
 *
 * Le jour est lu en UTC et non en heure locale : le serveur de préproduction
 * tourne en UTC, les postes du laboratoire à UTC+1. Sans cadrage commun, le
 * conseil changerait à un moment différent selon la machine qui rend la page.
 */
export function tipIndexForDay(now: Date, total = AUTH_TIPS.length): number {
  // Numéro de jour depuis l'époque, en UTC par construction : `getTime()` ne
  // connaît pas de fuseau. Le serveur de préproduction tourne en UTC et les
  // postes du laboratoire à UTC+1 ; sans cadrage commun, le conseil changerait
  // à un moment différent selon la machine qui rend la page.
  const jour = Math.floor(now.getTime() / 86_400_000);

  const cycle = Math.floor(jour / total);
  const rang = jour - cycle * total;

  return ordreDuCycle(total, cycle)[rang];
}

/**
 * Ordre des conseils sur un cycle, jointure corrigée.
 *
 * La correction s'applique au cycle **entier**, et non au seul premier jour :
 * une première version ne l'appliquait qu'au rang 0, si bien que le lendemain
 * recalculait l'ordre non corrigé et ressortait la valeur qui venait d'être
 * échangée — le doublon que la correction devait supprimer, décalé d'un jour.
 * Mesuré : huit répétitions par an au lieu de zéro.
 *
 * L'échange porte sur les rangs 0 et 1, qui ne touchent pas le dernier élément
 * dès que `total > 2` : l'ordre du cycle précédent peut donc être lu sans être
 * corrigé à son tour, ce qui éviterait sinon une récursion sans fond.
 */
function ordreDuCycle(total: number, cycle: number): number[] {
  const ordre = melange(total, cycle);
  if (total > 2) {
    const precedent = melange(total, cycle - 1);
    if (ordre[0] === precedent[total - 1]) {
      [ordre[0], ordre[1]] = [ordre[1], ordre[0]];
    }
  }
  return ordre;
}

/**
 * Permutation de `[0, total[` déterminée par `graine` — mélange de Fisher-Yates
 * tiré d'un xorshift32. Deux appels de même graine rendent le même ordre, ce
 * dont dépend la correction de jointure ci-dessus.
 */
function melange(total: number, graine: number): number[] {
  let h = (graine * 2654435761) | 0 || 1; // 0 est un point fixe du xorshift
  const suivant = () => {
    h ^= h << 13;
    h |= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h |= 0;
    return Math.abs(h);
  };

  const ordre = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = suivant() % (i + 1);
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return ordre;
}

/** Conseil du jour, prêt à afficher. */
export function tipOfTheDay(now: Date): AuthTip {
  return AUTH_TIPS[tipIndexForDay(now)];
}
