import { CHART_CATEGORICAL } from "@/lib/ui/chartColors";
import { cn } from "@/lib/utils";

/**
 * Courbe de tendance miniature, à loger dans une carte d'indicateur.
 *
 * Les cinq tableaux de bord du benchmark portent tous un micro-graphique dans
 * chaque carte chiffrée : le nombre dit l'état courant, la courbe dit d'où il
 * vient. Sans elle, « 128 examens » n'est pas interprétable — en hausse ou en
 * chute ? C'était le principal écart relevé face aux références.
 *
 * Rendu en SVG écrit à la main plutôt qu'avec recharts : une carte d'indicateur
 * en affiche une par tuile, et monter un moteur de graphique complet pour sept
 * points coûte plus cher que le reste de la carte réunie. Aucune interaction
 * n'est attendue ici — la lecture précise se fait sur le graphique de la page.
 *
 * @example
 * <StatCard
 *   title="Examens ce mois"
 *   value={128}
 *   chart={<Sparkline data={[92, 104, 98, 121, 115, 128]} />}
 * />
 */
export function Sparkline({
  data,
  color = CHART_CATEGORICAL[0],
  className,
  height = 36,
  filled = true,
}: {
  /** Série chronologique, du plus ancien au plus récent. Au moins 2 points. */
  data: number[];
  /** Par défaut l'azur primaire. Pour une série d'état, passer `CHART_STATUS`. */
  color?: string;
  className?: string;
  height?: number;
  /** Aplat dégradé sous la courbe. Le retirer pour une lecture plus sobre. */
  filled?: boolean;
}) {
  if (data.length < 2) return null;

  // Repère interne fixe : le SVG est étiré par `preserveAspectRatio="none"`,
  // ce qui permet à la carte de dicter la largeur sans recalcul en JS.
  const W = 100;
  const H = 32;

  const min = Math.min(...data);
  const max = Math.max(...data);
  // Série plate : sans garde, l'amplitude nulle diviserait par zéro et la
  // courbe disparaîtrait. On la pose alors à mi-hauteur.
  const span = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / span) * H;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  // Identifiant unique par instance : deux dégradés de même id sur une page
  // feraient hériter toutes les courbes de la couleur de la première.
  const gradientId = `spark-${color.replace("#", "")}-${data.length}-${Math.round(min)}-${Math.round(max)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      height={height}
      className={cn("w-full overflow-visible", className)}
      // Décoratif : la valeur et sa tendance sont déjà portées en texte par la
      // carte. L'annoncer une seconde fois n'apporterait rien au lecteur d'écran.
      aria-hidden="true"
      focusable="false"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Le SVG étant étiré, une épaisseur en unités du repère serait déformée
        // horizontalement. `non-scaling-stroke` garde un trait constant.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
