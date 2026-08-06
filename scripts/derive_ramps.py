"""Derive Tailwind-shaped colour ramps from the AnapathLab charter anchors.

Usage : python3 scripts/derive_ramps.py

Sort les gammes, les controles de contraste, et le bloc `@theme` a coller dans
`src/app/globals.css`. Executer AVANT toute retouche manuelle d'une valeur :
une graduation corrigee a la main casse la regularite du profil de clarte, et
c'est ce profil qui garantit les seuils de lisibilite.

The charter fixes five values and says each role "dispose d'une gamme tonale
100-900 (voir le systeme Broadsheet)" -- a system that was not delivered. The
ramps are interpolated here in OKLab, which keeps perceived lightness steps
even where sRGB interpolation bunches them up in the dark end.

Two shapes are imposed rather than derived, because a free interpolation
between the charter anchors fails in practice:

  * lightness follows Tailwind's own profile, so that every `gray-500` and
    `blue-600` already written across ~100 files keeps the contrast it had;
  * chroma follows a peak-at-600 curve, without which the pale steps clip out
    of gamut and come back as fluorescent cyan.
"""

# ---------- sRGB <-> OKLab ----------------------------------------------------

def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _linear_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

def hex_to_oklab(h):
    h = h.lstrip("#")
    r, g, b = (_srgb_to_linear(int(h[i:i+2], 16) / 255) for i in (0, 2, 4))
    l = (0.4122214708*r + 0.5363325363*g + 0.0514459929*b) ** (1/3)
    m = (0.2119034982*r + 0.6806995451*g + 0.1073969566*b) ** (1/3)
    s = (0.0883024619*r + 0.2817188376*g + 0.6299787005*b) ** (1/3)
    return (0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
            1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
            0.0259040371*l + 0.7827717662*m - 0.8086757660*s)

def oklab_to_hex(L, a, b_):
    l = (L + 0.3963377774*a + 0.2158037573*b_) ** 3
    m = (L - 0.1055613458*a - 0.0638541728*b_) ** 3
    s = (L - 0.0894841775*a - 1.2914855480*b_) ** 3
    rgb = (+4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
           -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
           -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)
    return "#" + "".join(
        f"{max(0, min(255, round(_linear_to_srgb(max(0.0, min(1.0, c))) * 255))):02x}"
        for c in rgb)

def luminance(h):
    h = h.lstrip("#")
    r, g, b = (_srgb_to_linear(int(h[i:i+2], 16) / 255) for i in (0, 2, 4))
    return 0.2126*r + 0.7152*g + 0.0722*b

def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# ---------- ramp shape --------------------------------------------------------

STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

# OKLab lightness, read off Tailwind's own neutral ramp. Keeping this profile is
# what guarantees a `text-gray-500` written a year ago stays legible today.
L_PROFILE = {50: 0.975, 100: 0.947, 200: 0.897, 300: 0.826, 400: 0.729,
             500: 0.638, 600: 0.552, 700: 0.470, 800: 0.400, 900: 0.330}

# Chroma relative to the anchor's, peaking at 600. A flat multiplier drives the
# pale steps out of sRGB, where clipping turns them fluorescent.
C_PROFILE = {50: 0.09, 100: 0.17, 200: 0.32, 300: 0.52, 400: 0.76,
             500: 0.93, 600: 1.00, 700: 0.96, 800: 0.87, 900: 0.78}


def ramp(anchors):
    """anchors: {step: hex}. Hue comes from the anchors; lightness follows
    L_PROFILE, rescaled piecewise so each anchor keeps its exact charter value."""
    ks = sorted(anchors)
    lab = {k: hex_to_oklab(anchors[k]) for k in ks}

    # Piecewise-linear remap of L_PROFILE so it passes through the anchors.
    def L_at(s):
        if s in anchors:
            return lab[s][0]
        lo = max([k for k in ks if k < s], default=None)
        hi = min([k for k in ks if k > s], default=None)
        # Hors des ancres, on extrapole -- mais en laissant le decalage
        # s'estomper a mesure qu'on s'eloigne. Un decalage rigide pousse le
        # pale hors de l'echelle (violet-50 sortait en blanc pur) ou l'assombrit
        # (red-50 en gris rose). A l'extremite, on retombe sur le profil nu.
        def faded(k, end):
            offset = lab[k][0] - L_PROFILE[k]
            span = abs(L_PROFILE[end] - L_PROFILE[k]) or 1.0
            t = min(1.0, abs(L_PROFILE[s] - L_PROFILE[k]) / span)
            return L_PROFILE[s] + offset * (1 - t)

        if lo is None:
            return faded(hi, STEPS[0])
        if hi is None:
            return faded(lo, STEPS[-1])
        span = L_PROFILE[lo] - L_PROFILE[hi]
        t = (L_PROFILE[lo] - L_PROFILE[s]) / span if span else 0.0
        return lab[lo][0] + t * (lab[hi][0] - lab[lo][0])

    # Hue/chroma from the nearest anchor, normalised to unit chroma.
    def ab_at(s):
        near = min(ks, key=lambda k: abs(k - s))
        _, a, b_ = lab[near]
        base = C_PROFILE[near]
        f = C_PROFILE[s] / base if base else 1.0
        return a * f, b_ * f

    out = {}
    for s in STEPS:
        if s in anchors:
            out[s] = anchors[s].lower()
            continue
        a, b_ = ab_at(s)
        out[s] = oklab_to_hex(L_at(s), a, b_)
    return out


def show(name, r, on=("#ffffff", "#f3f2f2")):
    print(f"\n  {name}")
    for s in STEPS:
        cs = "   ".join(f"{contrast(r[s], o):5.2f}:1/{o[1:]}" for o in on)
        print(f"    {s:<4} {r[s]}   {cs}")


print("=" * 78)
print("  GAMMES DERIVEES DES ANCRES DE LA CHARTE")
print("=" * 78)

# Primaire. La charte donne deux valeurs ; elles sont separees de deux crans,
# pas d'un : #38a6cf tombe en 400, #006786 en 600 (celui qui porte le blanc).
primary = ramp({400: "#38a6cf", 600: "#006786"})
show("PRIMAIRE (cyan)  ->  --color-blue-*", primary)

# Neutres : Papier et Encre de la charte aux extremites.
#
# Les deux graduations de texte doivent ensuite etre corrigees. Tailwind place
# ses neutres sur une teinte bleutee ; a lightness OKLab egale, un neutre chaud
# renvoie plus de luminance et perd du contraste. `text-gray-500` (284 usages)
# tomberait a 4.26:1, sous le seuil AA. On assombrit donc juste ce qu'il faut.
neutral = ramp({50: "#f3f2f2", 900: "#201e1d"})

def darken_until(hexv, on, target, step=0.004):
    """Lower OKLab lightness until the contrast target is met, hue untouched."""
    L, a, b_ = hex_to_oklab(hexv)
    out = hexv
    while contrast(out, on) < target and L > 0.05:
        L -= step
        out = oklab_to_hex(L, a, b_)
    return out

_before = dict(neutral)
neutral[500] = darken_until(neutral[500], "#ffffff", 4.6)   # texte secondaire
neutral[400] = darken_until(neutral[400], "#ffffff", 3.05)  # icones, bordures
show("NEUTRES  ->  --color-gray-*", neutral)
print("\n    corriges :", ", ".join(
    f"{s} {_before[s]} -> {neutral[s]}" for s in (400, 500) if _before[s] != neutral[s]))

# Critique : accent rare de la charte, jamais remappe sur red-*.
critical = ramp({600: "#d6006c"})
show("CRITIQUE (magenta)  ->  --color-critical-*", critical, on=("#ffffff",))

# Etats et accents secondaires, ancres sur la palette categorielle validee.
# Les graphiques et les pastilles partagent ainsi leurs teintes : un statut
# « en retard » a la meme couleur dans une pastille et dans un camembert.
danger  = ramp({600: "#ac2f3b"})   # brique
success = ramp({500: "#5a9c80"})   # vert sauge
warning = ramp({500: "#c26e12"})   # ambre
prune   = ramp({500: "#c480d4"})   # accent secondaire (violet-*/purple-*)
for nom, r in (("DANGER -> --color-red-*", danger),
               ("SUCCES -> --color-green-*", success),
               ("ALERTE -> --color-yellow-*", warning),
               ("PRUNE  -> --color-violet-*/purple-*", prune)):
    show(nom, r, on=("#ffffff",))

print("\n" + "=" * 78)
print("  VERIFICATIONS QUI DECIDENT DE L'USAGE")
print("=" * 78)
checks = [
    ("blanc sur bouton primaire (blue-600)",        "#ffffff", primary[600], 4.5),
    ("blanc sur survol du bouton (blue-700)",       "#ffffff", primary[700], 4.5),
    ("ecart de survol 600->700 (>= 1.3 percu)",     primary[600], primary[700], 1.0),
    ("lien primaire sur papier",                    primary[600], "#f3f2f2", 4.5),
    ("anneau de focus blue-500 sur blanc (63 us.)", primary[500], "#ffffff", 3.0),
    ("texte encre (gray-900) sur papier",           neutral[900], "#f3f2f2", 4.5),
    ("texte secondaire (gray-500) sur blanc",       neutral[500], "#ffffff", 4.5),
    ("texte tertiaire (gray-400) sur blanc",        neutral[400], "#ffffff", 3.0),
    ("bordure gray-200 sur blanc (non normee)",     neutral[200], "#ffffff", 1.0),
    ("blanc sur critique (critical-600)",           "#ffffff", critical[600], 4.5),
    ("critique sur papier (texte)",                 critical[600], "#f3f2f2", 4.5),
    # Pastilles teintees : le motif `bg-X-50 text-X-700` de StatCard et des
    # badges de statut. C'est la paire qui doit tenir, pas la couleur seule.
    ("pastille danger  : red-700 sur red-50",       danger[700],  danger[50],  4.5),
    ("pastille succes  : green-700 sur green-50",   success[700], success[50], 4.5),
    ("pastille alerte  : yellow-700 sur yellow-50", warning[700], warning[50], 4.5),
    ("pastille critique: critical-700 sur -50",     critical[700], critical[50], 4.5),
    ("pastille primaire: blue-700 sur blue-50",     primary[700], primary[50], 4.5),
    ("pastille prune   : violet-700 sur violet-50", prune[700],   prune[50],   4.5),
    ("icone primaire   : blue-600 sur blue-50",     primary[600], primary[50], 3.0),
]
fails = 0
for label, fg, bg, need in checks:
    c = contrast(fg, bg)
    ok = c >= need
    fails += not ok
    print(f"  {'OK ' if ok else 'NON'}  {c:5.2f}:1  (seuil {need})  {label}")
print(f"\n  {fails} echec(s)")

print("\n" + "=" * 78)
print("  BLOC @theme A COLLER")
print("=" * 78)
for label, r in (("blue", primary), ("gray", neutral), ("critical", critical),
                 ("red", danger), ("green", success), ("yellow", warning),
                 ("violet", prune)):
    print()
    for s in STEPS:
        print(f"  --color-{label}-{s}: {r[s]};")
