#!/usr/bin/env node
/**
 * Validateur de palette catégorielle.
 *
 * `src/lib/ui/chartColors.ts` impose de revalider toute modification de la
 * palette par ce script. Il était référencé sans exister : la consigne était
 * invérifiable depuis qu'elle était écrite. Ce fichier la rend exécutable.
 *
 * Six contrôles, dans l'ordre où ils écartent une palette :
 *
 *   1. bande de luminosité   — aucune série ne doit dominer par sa clarté
 *   2. plancher de chroma    — un gris parmi des couleurs se lit comme « autre »
 *   3. séparation en vision normale
 *   4. séparation sous déficience de vision des couleurs (deutéranopie,
 *      protanopie, tritanopie) — ~8 % des hommes
 *   5. contraste sur le fond  — une série ne doit pas disparaître dans le papier
 *   6. voisinage             — deux séries adjacentes dans l'ordre de tracé
 *                              doivent être les plus séparées possible
 *
 * Usage :
 *   node scripts/validate_palette.mjs "#006786,#d97706,..." [--mode light|dark]
 */

// ── sRGB ↔ OKLab ────────────────────────────────────────────────────────────

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hexToRgb(hex) {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`couleur invalide : ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function toOklab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const chroma = ([, a, b]) => Math.hypot(a, b);
const deltaE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;

function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(toLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

const contrast = (x, y) => {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
};

// ── Simulation des déficiences (Viénot, Brettel & Mollon 1999) ───────────────
// Matrices appliquées en LMS ; l'approximation est celle retenue par la
// plupart des outils d'accessibilité et suffit à écarter les paires fusionnées.

const RGB_TO_LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
];
const LMS_TO_RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
];
const CVD = {
  deuteranopie: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
  protanopie: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
  tritanopie: [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]],
};

const mul = (M, v) => M.map((row) => row.reduce((s, k, i) => s + k * v[i], 0));

function simulate(rgb, kind) {
  const lin = rgb.map(toLinear);
  const out = mul(LMS_TO_RGB, mul(CVD[kind], mul(RGB_TO_LMS, lin)));
  return out.map((c) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  });
}

// ── Seuils ──────────────────────────────────────────────────────────────────

const T = {
  lightnessBand: 0.42, // écart max de L entre la série la plus claire et la plus sombre
  chromaFloor: 0.045,  // en deçà, la teinte se lit comme un gris
  deltaNormal: 12,     // séparation minimale en vision normale
  deltaCvd: 9,         // séparation minimale sous déficience
  contrastBg: 2.2,     // une série doit se détacher du fond
  neighbourBonus: 15,  // séparation souhaitée entre séries adjacentes
};

// ── Exécution ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const list = args.find((a) => !a.startsWith("--"));
const mode = args.includes("--dark") || args[args.indexOf("--mode") + 1] === "dark"
  ? "dark" : "light";

if (!list) {
  console.error('usage : node scripts/validate_palette.mjs "#006786,#d97706,…" [--mode light|dark]');
  process.exit(2);
}

const BG = mode === "dark" ? hexToRgb("#201e1d") : hexToRgb("#f3f2f2");
const hexes = list.split(",").map((s) => s.trim()).filter(Boolean);
const rgb = hexes.map(hexToRgb);
const lab = rgb.map(toOklab);

const problems = [];
const notes = [];

// 1 — bande de luminosité
const Ls = lab.map((c) => c[0]);
const band = Math.max(...Ls) - Math.min(...Ls);
(band <= T.lightnessBand ? notes : problems).push(
  `bande de luminosité : ${band.toFixed(3)} (max ${T.lightnessBand})`);

// 2 — plancher de chroma
for (const [i, c] of lab.entries()) {
  const ch = chroma(c);
  if (ch < T.chromaFloor)
    problems.push(`chroma trop faible sur ${hexes[i]} : ${ch.toFixed(3)} (min ${T.chromaFloor})`);
}

// 3/4 — séparation, vision normale puis déficiences
const pairs = [];
for (let i = 0; i < hexes.length; i++)
  for (let j = i + 1; j < hexes.length; j++) pairs.push([i, j]);

let worstNormal = { d: Infinity };
for (const [i, j] of pairs) {
  const d = deltaE(lab[i], lab[j]);
  if (d < worstNormal.d) worstNormal = { d, i, j };
  if (d < T.deltaNormal)
    problems.push(`vision normale : ${hexes[i]} / ${hexes[j]} à ΔE ${d.toFixed(1)} (min ${T.deltaNormal})`);
}

for (const kind of Object.keys(CVD)) {
  const sim = rgb.map((c) => toOklab(simulate(c, kind)));
  for (const [i, j] of pairs) {
    const d = deltaE(sim[i], sim[j]);
    if (d < T.deltaCvd)
      problems.push(`${kind} : ${hexes[i]} / ${hexes[j]} à ΔE ${d.toFixed(1)} (min ${T.deltaCvd})`);
  }
}

// 5 — contraste sur le fond
for (const [i, c] of rgb.entries()) {
  const k = contrast(c, BG);
  if (k < T.contrastBg)
    problems.push(`${hexes[i]} se fond dans le papier : ${k.toFixed(2)}:1 (min ${T.contrastBg})`);
}

// 6 — voisinage dans l'ordre de tracé
for (let i = 0; i < hexes.length - 1; i++) {
  const d = deltaE(lab[i], lab[i + 1]);
  if (d < T.neighbourBonus)
    notes.push(`séries adjacentes ${hexes[i]} / ${hexes[i + 1]} à ΔE ${d.toFixed(1)} — envisager de les éloigner dans l'ordre`);
}

// ── Rapport ─────────────────────────────────────────────────────────────────

console.log(`\n  Palette (${hexes.length} séries, mode ${mode})\n`);
for (const [i, h] of hexes.entries()) {
  console.log(
    `    ${i}  ${h}   L ${lab[i][0].toFixed(3)}   C ${chroma(lab[i]).toFixed(3)}` +
    `   ${contrast(rgb[i], BG).toFixed(2)}:1 sur le fond`);
}
console.log(`\n    paire la plus proche en vision normale : ` +
  `${hexes[worstNormal.i]} / ${hexes[worstNormal.j]} à ΔE ${worstNormal.d.toFixed(1)}`);

if (notes.length) {
  console.log("\n  Remarques");
  for (const n of notes) console.log(`    · ${n}`);
}

if (problems.length) {
  console.log("\n  ÉCHECS");
  for (const p of problems) console.log(`    ✗ ${p}`);
  console.log(`\n  ${problems.length} échec(s)\n`);
  process.exit(1);
}
console.log("\n  ✓ les six contrôles passent\n");
