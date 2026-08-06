import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";

/**
 * Coque des écrans d'authentification — connexion, code 2FA, mot de passe
 * oublié, réinitialisation, choix de l'agence.
 *
 * Les cinq écrans recopiaient la même structure, avec les mêmes valeurs hors
 * système : `rounded-lg` et `shadow-md` là où le système pose
 * `--radius-surface` et ses trois élévations, et un titre en `text-2xl
 * font-bold` alors que la référence fixe 1.25rem semibold à interlettrage
 * resserré. Cinq copies signifient cinq occasions de diverger — c'est ce qui
 * était arrivé au reste de l'application avant la reprise du kit.
 *
 * La marque du PRODUIT coiffe systématiquement ces écrans : on se connecte à
 * LaboAnaPath, quel que soit le laboratoire. L'identité du client apparaît une
 * fois entré, dans la barre du haut et sur les documents.
 *
 * @example
 * <AuthCard title="Se connecter" subtitle="Accédez à votre espace de travail.">
 *   <form>…</form>
 * </AuthCard>
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  /** Phrase d'accroche sous le titre. Omise, rien ne s'affiche. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Zone basse séparée d'un filet — liens secondaires, retour au login. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12">
      <div className={cn("w-full max-w-md", className)}>
        <div className="overflow-hidden rounded-[var(--radius-surface)] bg-white shadow-[var(--elevation-raised)]">
          {/* Bandeau de marque. `--elevation-raised` et non `-flat` : la carte
              flotte seule au centre d'un fond uni, sans voisine pour donner
              l'échelle — l'ombre de contact seule y paraîtrait posée à plat. */}
          <div className="border-b border-gray-100 bg-gray-50/70 px-8 py-6 text-center">
            <Link
              href="/"
              className="inline-block rounded-[var(--radius-control)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <BrandMark className="text-[1.75rem]" />
            </Link>
          </div>

          <div className="px-8 py-8">
            {/* Corps de titre du système (1.25rem / 600 / -0.015em), et non le
                `text-2xl font-bold` que portaient les cinq écrans. */}
            <h1 className="text-[1.25rem] font-semibold tracking-[-0.015em] text-gray-900">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-[.9rem] leading-relaxed text-gray-500">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>

          {footer ? (
            <div className="border-t border-gray-100 bg-gray-50/70 px-8 py-4 text-center text-[.875rem] text-gray-500">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
