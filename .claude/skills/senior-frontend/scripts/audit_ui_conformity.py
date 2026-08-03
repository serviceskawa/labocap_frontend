#!/usr/bin/env python3
"""Audit de conformité UI — projet labo-anapath.

Contrôle mécaniquement les règles du standard décrit dans SKILL.md :
couleurs hors tokens Hyper, HTML brut là où le kit UI existe, actions de ligne
non conformes, pages sans en-tête, logo figé, permissions lues hors hook.

    python3 audit_ui_conformity.py src
    python3 audit_ui_conformity.py "src/app/(dashboard)/contracts" --verbose
    python3 audit_ui_conformity.py src --json > rapport.json

Sort en code 1 dès qu'une violation de sévérité « high » est trouvée, afin de
pouvoir servir de garde-fou en pre-commit.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

# --------------------------------------------------------------------------- #
# Règles
# --------------------------------------------------------------------------- #

# Valeur hexa écrite en dur dans une classe Tailwind arbitraire : contourne le
# remap des tokens Hyper opéré par globals.css.
HEX_IN_CLASS = re.compile(
    r"\b(?:bg|text|border|from|via|to|ring|fill|stroke|decoration|outline|"
    r"accent|caret|divide|placeholder)-\[#[0-9a-fA-F]{3,8}\]"
)

# Élément natif là où le kit UI fournit un composant.
RAW_ELEMENTS = {
    "button": ("Button / IconButton", "medium"),
    "input": ("TextInput / FormField, ou au minimum INPUT_CLASS", "high"),
    "select": ("FormSelect / NativeSelect / RemoteSelectField", "high"),
    "table": ("DataTable dans DataTableCard", "medium"),
}

# `|$` est indispensable : en JSX multi-ligne, la balise ouvrante est très souvent
# le dernier token de sa ligne (`<button` puis les props aux lignes suivantes).
# Sans l'alternative de fin de chaîne, ces cas — la majorité — passaient au travers.
RAW_ELEMENT_RE = re.compile(
    r"<(button|input|select|table)(?=[\s/>]|$)"
)

# Un `<input>` natif reste acceptable si son style vient du design system :
# la constante partagée (`src/lib/ui/inputClass.ts`, importée sous un alias local
# dans une quarantaine d'écrans) ou la classe Hyper `.hyper-form-control`, qui
# reproduit `.form-control` de Bootstrap à l'identique. Un `type="hidden"` ne
# porte aucun style et ne relève pas du kit.
CONFORMANT_INPUT = re.compile(
    r"\b(?:inputClass|INPUT_CLASS|fieldInput|readonlyClass)\b"
    r"|hyper-form-control"
    r"|type=\"hidden\""
)

# Un `<button>` porteur d'un fond (`bg-…`) reproduit à la main ce que `Button`
# fournit : c'est celui-là qu'il faut remplacer. Un bouton stylé en lien — une
# cellule de tableau cliquable, un « Retour » discret — n'a pas d'équivalent dans
# le kit et reste légitime. Sans ce filtre, la règle noyait le signal utile.
# Le lookbehind `(?<!:)` écarte `hover:bg-…` / `focus:bg-…` : un bouton dont le
# fond n'apparaît qu'au survol est une affordance fantôme (icône de tableau,
# chevron), pas un bouton plein. Sans lui, la règle remontait ces cas par dizaines.
FILLED_BUTTON = re.compile(r"(?<!:)\bbg-(?!transparent\b)[a-z]")

LOGO_HARDCODED = re.compile(r"""src=["']/logo\.png""")
ICON_ONLY_DISABLED = re.compile(r"iconOnly=\{false\}")
RAW_HAS_PERMISSION = re.compile(r"\bhasPermission\s*\(")

# Fichiers autorisés à faire ce que les autres n'ont pas le droit de faire.
#
# Le kit UI *implémente* les tokens : c'est le seul endroit où une valeur Hyper
# sans équivalent Tailwind (fonds « lighten » à 18 % des badges, par exemple) a
# sa place en dur. La coque applicative (`components/layout`) rend en revanche
# des éléments natifs légitimes — le hamburger de la topbar n'est pas un
# `Button` métier — mais reste tenue d'utiliser les tokens de couleur.
STYLE_OWNER_DIRS = ("components/ui", "components/common")
RAW_ELEMENT_OK_DIRS = STYLE_OWNER_DIRS + ("components/layout",)
PERMISSION_OWNERS = ("hooks/usePermissions.ts", "stores/auth.store.ts")

# Les écrans d'impression n'ont volontairement pas d'en-tête de page.
NO_HEADER_OK = ("/print/", "/preview/")


@dataclass
class Finding:
    file: str
    line: int
    rule: str
    severity: str
    message: str
    excerpt: str


def owns_styles(rel: str) -> bool:
    return any(d in rel for d in STYLE_OWNER_DIRS)


def may_use_raw_elements(rel: str) -> bool:
    return any(d in rel for d in RAW_ELEMENT_OK_DIRS)


def strip_comment_lines(text: str) -> set[int]:
    """Numéros de ligne (1-indexés) appartenant à un commentaire de bloc.

    Le repo commente abondamment en français, souvent en citant du code
    (« ✗ bg-[#727cf5] »). Sans ce filtre, les exemples contre-modèles des
    commentaires seraient comptés comme des violations.
    """
    inside = set()
    in_block = False
    for i, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if in_block:
            inside.add(i)
            if "*/" in line:
                in_block = False
            continue
        if line.startswith("//"):
            inside.add(i)
        # `{/*` : commentaire JSX, la forme la plus courante dans ce repo.
        elif line.startswith("/*") or line.startswith("{/*"):
            inside.add(i)
            if "*/" not in line:
                in_block = True
    return inside


def open_tag(text: str, start: int) -> str:
    """Texte de la balise ouvrante commençant à `start`, jusqu'à son `>`.

    Les props JSX s'étalent sur plusieurs lignes : `className={inputClass}` se
    trouve presque toujours *après* la ligne portant `<input`. Une règle qui
    n'examine qu'une ligne ne peut donc pas juger de la conformité d'un élément.
    On suit la profondeur des accolades et l'état des guillemets pour ne pas
    s'arrêter sur un `>` contenu dans une expression (`{a > b}`) ou une chaîne.
    """
    depth = 0
    quote = ""
    i = start
    end = min(len(text), start + 4000)  # garde-fou : une balise n'est jamais si longue
    while i < end:
        ch = text[i]
        if quote:
            if ch == quote:
                quote = ""
        elif ch in "\"'`":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == ">" and depth == 0:
            return text[start:i + 1]
        i += 1
    return text[start:end]


def audit_file(path: Path, root: Path) -> list[Finding]:
    rel = path.relative_to(root).as_posix()
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    findings: list[Finding] = []
    comment_lines = strip_comment_lines(text)
    lines = text.splitlines()
    style_owner = owns_styles(rel)
    raw_ok = may_use_raw_elements(rel)

    for n, line in enumerate(lines, start=1):
        if n in comment_lines:
            continue
        excerpt = line.strip()[:120]

        if not style_owner:
            for m in HEX_IN_CLASS.finditer(line):
                findings.append(Finding(
                    rel, n, "hex-hors-token", "high",
                    f"Couleur en dur `{m.group(0)}` — utiliser la classe Tailwind "
                    f"remappée (cf. references/design-system.md).",
                    excerpt,
                ))

        if LOGO_HARDCODED.search(line):
            findings.append(Finding(
                rel, n, "logo-fige", "high",
                "Logo figé sur /logo.png — utiliser <AppLogo /> "
                "(alimenté par les Paramètres).",
                excerpt,
            ))

        if ICON_ONLY_DISABLED.search(line):
            findings.append(Finding(
                rel, n, "actions-avec-libelle", "medium",
                "Actions de ligne avec libellé — Laravel les affiche en icône "
                "seule (défaut de RowActions).",
                excerpt,
            ))

        if RAW_HAS_PERMISSION.search(line) and not rel.endswith(PERMISSION_OWNERS):
            findings.append(Finding(
                rel, n, "permission-hors-hook", "medium",
                "`hasPermission` lu directement — passer par usePermissions() "
                "ou <PermissionGate> (garde d'hydratation).",
                excerpt,
            ))

    # Éléments natifs — analysés balise par balise, et non ligne par ligne : les
    # props JSX s'étalent sur plusieurs lignes et c'est l'élément entier qui dit
    # s'il est conforme.
    if not raw_ok:
        for m in RAW_ELEMENT_RE.finditer(text):
            n = text.count("\n", 0, m.start()) + 1
            if n in comment_lines:
                continue

            tag = m.group(1)
            tag_text = open_tag(text, m.start())

            if tag == "input" and CONFORMANT_INPUT.search(tag_text):
                continue
            if tag == "button" and not FILLED_BUTTON.search(tag_text):
                continue

            replacement, severity = RAW_ELEMENTS[tag]
            findings.append(Finding(
                rel, n, f"html-brut-{tag}", severity,
                f"`<{tag}>` natif hors kit UI — utiliser {replacement}.",
                " ".join(tag_text.split())[:120],
            ))

    # Règle au niveau du fichier : toute page du dashboard porte un PageHeader.
    # Une page qui ne fait que rediriger n'affiche rien et n'est pas concernée.
    is_redirect_only = "redirect(" in text and "return" not in text.split("redirect(")[0][-200:]

    if (
        path.name == "page.tsx"
        and "app/(dashboard)" in rel
        and "PageHeader" not in text
        and not is_redirect_only
        and not any(marker in rel for marker in NO_HEADER_OK)
    ):
        findings.append(Finding(
            rel, 1, "page-sans-entete", "medium",
            "Page sans <PageHeader> — titre, fil d'Ariane et slot d'action "
            "sont attendus sur tout écran du dashboard.",
            "",
        ))

    return findings


def collect(target: Path, root: Path) -> list[Finding]:
    if target.is_file():
        return audit_file(target, root)

    findings: list[Finding] = []
    for path in sorted(target.rglob("*.tsx")):
        if "node_modules" in path.parts or ".next" in path.parts:
            continue
        findings.extend(audit_file(path, root))
    return findings


SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def report(findings: list[Finding], verbose: bool) -> None:
    if not findings:
        print("✓ Aucune non-conformité détectée.")
        return

    by_rule: dict[str, list[Finding]] = {}
    for f in findings:
        by_rule.setdefault(f.rule, []).append(f)

    counts = {"high": 0, "medium": 0, "low": 0}
    for f in findings:
        counts[f.severity] += 1

    print(f"{len(findings)} non-conformités "
          f"({counts['high']} high · {counts['medium']} medium · {counts['low']} low)\n")

    for rule in sorted(by_rule, key=lambda r: (SEVERITY_ORDER[by_rule[r][0].severity], r)):
        group = by_rule[rule]
        sev = group[0].severity
        print(f"── {rule} [{sev}] — {len(group)} occurrence(s)")
        print(f"   {group[0].message}")

        if verbose:
            for f in group:
                print(f"     {f.file}:{f.line}")
                if f.excerpt:
                    print(f"       {f.excerpt}")
        else:
            files: dict[str, int] = {}
            for f in group:
                files[f.file] = files.get(f.file, 0) + 1
            for name, count in sorted(files.items(), key=lambda kv: -kv[1])[:8]:
                print(f"     {name} ({count})")
            if len(files) > 8:
                print(f"     … et {len(files) - 8} autre(s) fichier(s)")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit de conformité UI du front labo-anapath."
    )
    parser.add_argument("target", help="Fichier ou dossier à auditer (ex. src)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Détail ligne à ligne")
    parser.add_argument("--json", action="store_true",
                        help="Sortie JSON brute")
    parser.add_argument("--root", default=".",
                        help="Racine du projet pour les chemins relatifs (défaut : .)")
    args = parser.parse_args()

    target = Path(args.target)
    if not target.exists():
        print(f"Chemin introuvable : {target}", file=sys.stderr)
        return 2

    root = Path(args.root).resolve()
    findings = collect(target.resolve(), root)

    if args.json:
        print(json.dumps([asdict(f) for f in findings], ensure_ascii=False, indent=2))
    else:
        report(findings, args.verbose)

    return 1 if any(f.severity == "high" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
