import { CHART_CATEGORICAL } from "@/lib/ui/chartColors";
import { cn } from "@/lib/utils";

/**
 * Barres miniatures, à loger dans une carte d'indicateur.
 *
 * Alternative à {@link Sparkline} pour une série *discrète* — un décompte par
 * jour, par mois, par catégorie. La courbe suggère une continuité : l'employer
 * sur sept valeurs journalières laisse croire à une mesure continue alors qu'il
 * s'agit de sept relevés distincts.
 *
 * La dernière barre est mise en avant (les autres sont atténuées) : c'est la
 * lecture qu'on cherche dans une carte d'indicateur — où en est-on *maintenant*,
 * comparé aux périodes précédentes. C'est le parti pris des cartes de Shield et
 * de Healthqoe dans le benchmark.
 *
 * @example
 * <StatCard
 *   title="Prélèvements / jour"
 *   value={42}
 *   chart={<MiniBars data={[31, 28, 35, 40, 38, 45, 42]} />}
 * />
 */
export function MiniBars({
  data,
  color = CHART_CATEGORICAL[0],
  className,
  height = 36,
  highlightLast = true,
}: {
  /** Valeurs, de la plus ancienne à la plus récente. */
  data: number[];
  color?: string;
  className?: string;
  height?: number;
  /** Détacher la dernière valeur des précédentes. */
  highlightLast?: boolean;
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 0) || 1;
  // Écart proportionnel plutôt que fixe : à 30 barres un écart de 2px les
  // ferait disparaître, à 5 barres elles se toucheraient.
  const gap = 100 / data.length / 5;
  const barWidth = (100 - gap * (data.length - 1)) / data.length;

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      height={height}
      className={cn("w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      {data.map((v, i) => {
        // Plancher de 2 unités : une valeur nulle ou très faible produirait une
        // barre invisible, qu'on lirait comme une donnée manquante plutôt que
        // comme un zéro.
        const h = Math.max((v / max) * 32, 2);
        const isLast = i === data.length - 1;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={32 - h}
            width={barWidth}
            height={h}
            rx="1"
            fill={color}
            opacity={highlightLast && !isLast ? 0.28 : 1}
          />
        );
      })}
    </svg>
  );
}
