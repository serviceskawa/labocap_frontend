#!/usr/bin/env node
/**
 * Vérifie que les hashes SHA-256 codés dans la CSP correspondent toujours au
 * contenu réellement injecté par les dépendances.
 *
 * sonner insère un bloc CSS constant dans `<head>` au premier import et
 * n'accepte aucun nonce : la politique l'autorise donc par son hash. Ce hash
 * change à chaque mise à jour de la librairie — sans ce garde-fou, la
 * régression est silencieuse en Report-Only et purement visuelle en mode
 * bloquant (toasts non stylés), donc facile à manquer.
 *
 * À lancer après tout `npm install`/`npm update` — et en CI, aux côtés
 * d'OSV-Scanner, dans la Definition of Done.
 *
 *   node scripts/check-csp-hashes.mjs           vérifie
 *   node scripts/check-csp-hashes.mjs --fix     réécrit la constante
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const CSP_MODULE = "src/lib/security/csp.ts";
const SONNER_BUNDLE = "node_modules/sonner/dist/index.mjs";
const CONSTANT = "SONNER_STYLE_HASH";

/**
 * Extrait l'argument littéral passé à `__insertCSS(...)` dans le bundle sonner
 * et l'évalue pour obtenir la chaîne CSS exacte que verra le navigateur.
 */
function sonnerCss() {
  const source = readFileSync(SONNER_BUNDLE, "utf8");
  const marker = "\n__insertCSS(";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(
      `Appel à __insertCSS introuvable dans ${SONNER_BUNDLE}. La façon dont ` +
        `sonner injecte son CSS a changé : revoir style-src-elem dans ${CSP_MODULE}.`,
    );
  }
  const from = start + marker.length;
  const end = source.indexOf(");\n", from);
  if (end < 0) throw new Error(`Appel à __insertCSS non terminé dans ${SONNER_BUNDLE}.`);
  // L'argument est un littéral de chaîne : `eval` en restitue la valeur exacte,
  // échappements compris, ce qu'un simple découpage ne ferait pas.
  const css = eval(source.slice(from, end));
  if (typeof css !== "string" || css.length === 0) {
    throw new Error("Le CSS extrait de sonner est vide ou n'est pas une chaîne.");
  }
  return css;
}

const expected = `'sha256-${createHash("sha256").update(sonnerCss(), "utf8").digest("base64")}'`;

const source = readFileSync(CSP_MODULE, "utf8");
const declared = source.match(
  new RegExp(`${CONSTANT}\\s*=\\s*\\n?\\s*("[^"]+")`),
)?.[1];

if (!declared) {
  console.error(`✗ Constante ${CONSTANT} introuvable dans ${CSP_MODULE}.`);
  process.exit(1);
}

const declaredValue = JSON.parse(declared);

if (declaredValue === expected) {
  console.log(`✓ ${CONSTANT} à jour (${expected}).`);
  process.exit(0);
}

if (process.argv.includes("--fix")) {
  writeFileSync(
    CSP_MODULE,
    source.replace(declared, JSON.stringify(expected)),
    "utf8",
  );
  console.log(`✓ ${CONSTANT} mis à jour : ${declaredValue} → ${expected}`);
  process.exit(0);
}

console.error(
  `✗ ${CONSTANT} a dérivé.\n` +
    `    déclaré : ${declaredValue}\n` +
    `    attendu : ${expected}\n` +
    `  sonner a changé son CSS. Relancer avec --fix, puis vérifier que les ` +
    `toasts restent stylés sur un build de production.`,
);
process.exit(1);
