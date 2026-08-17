"use client";

import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { useAuthTip } from "./AuthTipProvider";
import type { AuthTip } from "@/lib/auth-tips";
import { cn } from "@/lib/utils";

/**
 * Coque des écrans d'authentification — connexion, code 2FA, mot de passe
 * oublié, réinitialisation, choix de l'agence.
 *
 * Les cinq écrans recopiaient la même structure, avec les mêmes valeurs hors
 * système. Cinq copies signifient cinq occasions de diverger : elles partagent
 * donc cette coque.
 *
 * La marque du PRODUIT coiffe systématiquement ces écrans : on se connecte à
 * AnapathLab, quel que soit le laboratoire. L'identité du client apparaît une
 * fois entré, dans la barre du haut et sur les documents.
 *
 * ## L'écran scindé
 *
 * Les maquettes de la charte remplacent la carte centrée par deux colonnes :
 * un panneau d'encre à gauche qui porte la marque et un conseil de sécurité,
 * le formulaire à droite sur le papier.
 *
 * Ce n'est pas qu'une question d'allure. La carte centrée laissait un écran
 * large aux trois quarts vide et posait la marque en petit au-dessus d'un
 * formulaire — l'application se présentait par son formulaire. Le panneau rend
 * à la marque la place qu'un premier écran lui doit, et occupe l'espace mort
 * par la seule chose qu'il soit utile de dire à quelqu'un qui n'est pas encore
 * entré : ce qu'on attendra de lui une fois dedans.
 *
 * ## Le panneau disparaît sous 1024 px
 *
 * Il n'est ni replié ni empilé : supprimé. Sur un téléphone, cet écran sert à
 * taper un mot de passe ; faire défiler un conseil avant d'atteindre le champ
 * changerait une information offerte en obstacle. La marque, elle, reste — en
 * tête du formulaire, là où le panneau la portait.
 *
 * @example
 * <AuthCard title="Se connecter" subtitle="Renseignez vos identifiants.">
 *   <form>…</form>
 * </AuthCard>
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  tip,
  className,
}: {
  title: string;
  /** Phrase d'accroche sous le titre. Omise, rien ne s'affiche. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Zone basse séparée d'un filet — liens secondaires, retour à la connexion. */
  footer?: React.ReactNode;
  /**
   * Conseil du panneau. Par défaut celui du jour, tiré côté serveur.
   *
   * L'écran de vérification en deux étapes passe le sien : c'est le seul moment
   * de l'application où une menace précise est active — quelqu'un qui détient
   * déjà le mot de passe réclame par téléphone le code qui vient d'arriver. Un
   * conseil général y gâcherait le seul endroit où l'avertissement porte.
   */
  tip?: AuthTip;
  className?: string;
}) {
  const jour = useAuthTip();
  const conseil = tip ?? jour?.tip;

  // Le fil d'indication ne se justifie que pour le conseil du jour : il dit
  // lequel des sept est affiché. Sur un conseil imposé, il n'indiquerait rien.
  const fil = tip ? null : jour;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Panneau ────────────────────────────────────────────────────── */}
      {conseil ? (
        <aside className="hidden w-[42%] max-w-[34rem] flex-col justify-between bg-surface-deep p-12 lg:flex">
          <BrandMark surface="dark" className="text-[1.35rem]" />

          <div className="max-w-[26rem]">
            <p className="text-[.75rem] font-semibold uppercase tracking-[0.14em] text-blue-300">
              Conseil de sécurité
            </p>
            {/* `text-balance` : le titre tient rarement sur une ligne, et une
                dernière ligne d'un seul mot se voit à cette taille. */}
            <h2 className="mt-4 text-balance text-[1.75rem] font-semibold leading-[1.2] text-white">
              {conseil.titre}
            </h2>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/70">
              {conseil.corps}
            </p>

            {fil ? (
              <div
                className="mt-8 flex items-center gap-2"
                // Purement indicatif : ces pastilles ne se cliquent pas, et
                // annoncer « 3 sur 7 » n'apprendrait rien à un lecteur d'écran
                // sur le conseil lui-même, qui est juste au-dessus.
                aria-hidden="true"
              >
                {Array.from({ length: fil.total }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-[width,background-color] duration-[var(--duration-base)] ease-emphasized",
                      i === fil.index ? "w-6 bg-blue-300" : "w-1.5 bg-white/25",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <p className="text-[.8125rem] text-white/50">
            Système de gestion du laboratoire d&apos;anatomopathologie
          </p>
        </aside>
      ) : null}

      {/* ── Formulaire ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className={cn("w-full max-w-[25rem]", className)}>
          {/* La marque n'apparaît ici que lorsque le panneau est absent — sinon
              elle serait affichée deux fois sur le même écran. */}
          <Link
            href="/"
            className="mb-10 inline-block rounded-[var(--radius-control)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 lg:hidden"
          >
            <BrandMark className="text-[1.35rem]" />
          </Link>

          <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-gray-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-[.9375rem] leading-relaxed text-gray-500">
              {subtitle}
            </p>
          ) : null}

          <div className="mt-8">{children}</div>

          {footer ? (
            <div className="mt-8 border-t border-gray-200 pt-6 text-[.875rem] text-gray-500">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
