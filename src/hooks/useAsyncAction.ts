"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Enveloppe une action asynchrone (téléchargement, export, appel API hors
 * react-query) pour en exposer l'état d'avancement et garantir qu'un seul appel
 * court à la fois.
 *
 * Motivation : un bouton dont l'action met une seconde à répondre est cliqué
 * deux fois. `pending` sert à afficher le spinner et à désactiver le bouton, et
 * le verrou interne (`runningRef`) ignore les clics qui passeraient malgré tout
 * (double-clic très rapide, touche Entrée maintenue).
 *
 * @example
 * const pdf = useAsyncAction(async () => { await download(); });
 * <Button loading={pdf.pending} onClick={pdf.run}>Voir tout</Button>
 */
export function useAsyncAction<A extends unknown[]>(
  action: (...args: A) => Promise<unknown>,
) {
  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);

  const run = useCallback(
    async (...args: A) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setPending(true);
      try {
        await action(...args);
      } finally {
        runningRef.current = false;
        setPending(false);
      }
    },
    [action],
  );

  return { pending, run };
}
