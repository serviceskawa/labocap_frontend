import { Badge } from "@/components/ui/Badge";
import type { BiologyKind } from "@/types/api";

export const BIOLOGY_KIND_LABELS: Record<BiologyKind, string> = {
  PANEL: "Paramètres",
  CULTURE: "Culture",
};

/** Nature d'une analyse de biologie : fiche de paramètres ou culture. */
export function BiologyKindBadge({ kind }: { kind?: BiologyKind | null }) {
  if (!kind) return <span className="text-gray-400">—</span>;
  return (
    <Badge variant={kind === "CULTURE" ? "warning" : "info"}>
      {BIOLOGY_KIND_LABELS[kind]}
    </Badge>
  );
}
