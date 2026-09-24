import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { BiologyFlag } from "@/lib/api/biologyResults";
import { flagLabel } from "./resultFlags";

/**
 * Indicateur d'un résultat de biologie.
 *
 * - N : neutre — une valeur normale ne doit pas attirer l'œil ;
 * - L, H, A : rouge (danger), hors valeurs de référence ;
 * - LL, HH : gamme « critique » (magenta), que la charte réserve aux
 *   résultats critiques — jamais confondue avec le rouge des erreurs.
 *
 * `preview` : indicateur calculé à l'écran avant enregistrement ; il est
 * marqué comme tel, le serveur restant seul juge.
 */
export function FlagBadge({
  flag,
  labels,
  overridden = false,
  preview = false,
}: {
  flag: BiologyFlag;
  labels?: Record<string, string> | null;
  overridden?: boolean;
  preview?: boolean;
}) {
  const critical = flag === "LL" || flag === "HH";
  const label = flagLabel(flag, labels);
  const title = [
    `Indicateur ${flag}`,
    overridden ? "posé manuellement" : null,
    preview ? "aperçu — calculé à l'enregistrement" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span title={title} className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <Badge
        variant={flag === "N" ? "secondary" : "danger"}
        className={cn(
          critical && "bg-critical-50 text-critical-700 ring-critical-200",
          preview && "opacity-75",
        )}
      >
        {label}
        {overridden ? " *" : ""}
      </Badge>
      {preview && <span className="text-[11px] italic text-gray-400">aperçu</span>}
    </span>
  );
}
