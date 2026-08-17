"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * Donut générique.
 *
 * Une part non nulle mais minuscule (3 factures d'avoir sur 12 418, soit
 * 0,02 %) trace un arc de 0,09° : invisible à l'écran. La légende annonce
 * alors quatre couleurs alors que le donut n'en montre que deux, ce qui se lit
 * comme un bug de couleurs. On dessine donc chaque part non nulle avec un arc
 * plancher (`minSlicePercent` du total), tout en gardant la valeur réelle pour
 * l'infobulle et pour la légende.
 *
 * L'anneau est plein : ni `paddingAngle` ni contour blanc entre les parts. Le
 * seul blanc visible est le trou central du donut ; tout le reste de la
 * couronne appartient à une couleur de la légende.
 */
export function DonutChart({
  segments,
  minSlicePercent = 3,
}: {
  segments: DonutSegment[];
  minSlicePercent?: number;
}) {
  const filtered = segments.filter((s) => s.value > 0);
  if (filtered.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-4">Aucune donnée</p>
    );
  }
  const total = filtered.reduce((sum, s) => sum + s.value, 0);
  const floor = (total * minSlicePercent) / 100;
  const data = filtered.map((s) => ({ ...s, arc: Math.max(s.value, floor) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="arc"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={0}
        >
          {data.map((entry, i) => (
            // Contour de la couleur de la part : sans lui, recharts trace un
            // liseré blanc par défaut entre deux secteurs adjacents.
            <Cell
              key={i}
              fill={entry.color}
              stroke={entry.color}
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, item) => {
            const real = (item?.payload as DonutSegment | undefined)?.value;
            return [real ?? value, name];
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
