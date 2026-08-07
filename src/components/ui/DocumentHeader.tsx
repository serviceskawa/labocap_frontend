import { cn } from "@/lib/utils";

/**
 * En-tête des documents imprimés — feuille de route, feuille de caisse.
 *
 * ## Pourquoi l'identité du LABORATOIRE, et non celle du produit
 *
 * La coque de l'application porte la marque AnapathLab : on se connecte à un
 * logiciel. Un document imprimé, lui, sort du laboratoire et l'engage — c'est
 * son nom qui doit y figurer, pas celui de son éditeur. La charte range
 * d'ailleurs les documents avec les surfaces à logotype du client (§6).
 *
 * ## Pourquoi le nom s'affiche même quand un logo existe
 *
 * La feuille de caisse n'affichait le logo que s'il était configuré, et rien du
 * tout sinon — or aucun logo n'est renseigné en production, si bien qu'elle
 * sortait de l'imprimante sans mentionner le laboratoire nulle part. Un
 * document comptable anonyme n'est pas un défaut d'esthétique.
 *
 * Le nom accompagne donc toujours le logo : un logo se reconnaît, il ne se lit
 * pas, et une pièce transmise à un tiers doit pouvoir être rattachée sans
 * connaître la marque.
 */
export function DocumentHeader({
  logoSrc,
  name,
  subtitle,
  align = "center",
  className,
}: {
  /** Logo du laboratoire, déjà filtré des valeurs sentinelles. Vide si absent. */
  logoSrc?: string;
  /** Raison sociale du laboratoire — toujours affichée. */
  name: string;
  /** Adresse, téléphone : ce qui permet de recontacter l'émetteur. */
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-b border-gray-300 pb-4",
        align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {logoSrc ? (
        <div className={cn("mb-3 flex", align === "center" ? "justify-center" : "justify-start")}>
          {/* Les logos issus des Paramètres sont des data-URI : `next/image`
              n'apporterait rien et ajouterait un optimiseur au runtime.
              `max-h` plutôt que `h` : un logo très large ne doit pas repousser
              le reste du document hors de la page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            className="max-h-16 w-auto max-w-[45%] object-contain"
          />
        </div>
      ) : null}

      <h1 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
        {name}
      </h1>
      {subtitle ? (
        <p className="mt-0.5 text-[.8125rem] text-gray-600">{subtitle}</p>
      ) : null}
    </header>
  );
}
