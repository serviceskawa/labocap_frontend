"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cashboxApi, type CashboxDailyResponseDto } from "@/lib/api/cashbox";
import { isPlaceholder, DEFAULT_APP_NAME } from "@/hooks/useBranding";
import { formatCFAAvecDevise } from "@/lib/utils";
import { DocumentHeader } from "@/components/ui/DocumentHeader";
import { Button } from "@/components/ui/Button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

/**
 * Montant AVEC son unité — c'est un document.
 *
 * Les écrans ont perdu la mention : dans une application qui ne sert qu'une
 * zone monétaire, la répéter à chaque ligne n'apprend rien. Une feuille de
 * caisse, elle, sort de l'application et s'archive : elle se lira hors
 * contexte, peut-être des années plus tard, peut-être par un tiers.
 */
function formatMontant(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return formatCFAAvecDevise(v);
}

// Date + heure (l'en-tête Laravel affiche created_at / updated_at avec l'heure).
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Page imprimable de clôture (réplique cashbox_daily.print)
// ---------------------------------------------------------------------------

export default function CashboxDailyPrintPage({ params }: PageProps) {
  const { id } = use(params);

  const { data: daily, isLoading } = useQuery({
    queryKey: ["cashbox-daily", id],
    queryFn: () => cashboxApi.getDaily(id).then((r) => r.data),
  });

  const { data: appSettings } = useAppSettings();
  // Le logo du laboratoire a toute sa place ICI — un document imprimé engage le
  // laboratoire, pas l'éditeur du logiciel. `isPlaceholder` écarte la sentinelle
  // « path » de `setting_apps`, qui ferait imprimer une image cassée.
  const rawLogo = appSettings?.logo?.trim() || appSettings?.logo_white?.trim() || "";
  const logoSrc = isPlaceholder(rawLogo) ? "" : rawLogo;
  const appName = appSettings?.app_name?.trim() || DEFAULT_APP_NAME;

  // Déclenche l'impression automatiquement une fois les données chargées.
  useEffect(() => {
    if (daily) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [daily]);

  if (isLoading || !daily) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Barre d'action — masquée à l'impression */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/cashbox/cashbox-daily"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
          Imprimer
        </Button>
      </div>

      <RecapPrint daily={daily} logoSrc={logoSrc} appName={appName} />
    </div>
  );
}

function RecapPrint({
  daily,
  logoSrc,
  appName,
}: {
  daily: CashboxDailyResponseDto;
  logoSrc: string;
  appName: string;
}) {
  const opening = daily.openingBalance ?? 0;
  const cashCalc = daily.cashCalculated ?? 0;
  const soldeEspeces = opening + cashCalc;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      {/* En-tête du document. Le logo n'était affiché que s'il était configuré,
          et rien du tout sinon — or aucun logo n'est renseigné en production :
          la feuille sortait de l'imprimante sans mentionner le laboratoire
          nulle part. Le nom est désormais toujours porté. */}
      <DocumentHeader logoSrc={logoSrc} name={appName} className="mb-6" />

      <h2 className="mb-6 text-center text-[.9375rem] font-semibold text-gray-800">
        {daily.code} — {formatDateTime(daily.createdAt)}
        {daily.updatedAt ? ` → ${formatDateTime(daily.updatedAt)}` : ""}
      </h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left text-xs font-semibold uppercase text-gray-600">
            <th className="py-2 pr-4">Mode de paiement</th>
            <th className="py-2 pr-4 text-right">Fond initial</th>
            <th className="py-2 pr-4 text-right">Vente</th>
            <th className="py-2 pr-4 text-right">Solde</th>
            <th className="py-2 pr-4 text-right">Comptage</th>
            <th className="py-2 text-right">Écart</th>
          </tr>
        </thead>
        <tbody>
          <Row
            label="Espèces"
            fond={formatMontant(opening)}
            vente={formatMontant(cashCalc)}
            solde={formatMontant(soldeEspeces)}
            comptage={formatMontant(daily.cashConfirmation)}
            ecart={formatMontant(daily.cashEcart)}
          />
          <Row
            label="Mobile Money"
            fond="-"
            vente={formatMontant(daily.mobileMoneyCalculated)}
            solde="-"
            comptage={formatMontant(daily.moneyMoneyConfirmation)}
            ecart={formatMontant(daily.mobileMoneyEcart)}
          />
          <Row
            label="Chèque"
            fond="-"
            vente={formatMontant(daily.chequeCalculated)}
            solde="-"
            comptage={formatMontant(daily.chequeConfirmation)}
            ecart={formatMontant(daily.chequeEcart)}
          />
          <Row
            label="Virement"
            fond="-"
            vente={formatMontant(daily.virementCalculated)}
            solde="-"
            comptage={formatMontant(daily.virementConfirmation)}
            ecart={formatMontant(daily.virementEcart)}
          />
          <tr className="border-t-2 border-gray-400 font-bold">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4 text-right">{formatMontant(opening)}</td>
            <td className="py-2 pr-4 text-right">{formatMontant(daily.totalCalculated)}</td>
            <td className="py-2 pr-4 text-right">{formatMontant(soldeEspeces)}</td>
            <td className="py-2 pr-4 text-right">{formatMontant(daily.totalConfirmation)}</td>
            <td className="py-2 text-right">{formatMontant(daily.totalEcart)}</td>
          </tr>
        </tbody>
      </table>

      {/* Commentaire de clôture (calque print.blade). */}
      <div className="mt-6">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Commentaire
        </label>
        <input
          value={daily.description ?? ""}
          readOnly
          className={inputClass}
        />
      </div>

      <p className="mt-8 text-right text-lg font-bold text-gray-900">
        SOLDE DE FERMETURE : {formatMontant(daily.closingBalance)}
      </p>
    </div>
  );
}

function Row({
  label,
  fond,
  vente,
  solde,
  comptage,
  ecart,
}: {
  label: string;
  fond: string;
  vente: string;
  solde: string;
  comptage: string;
  ecart: string;
}) {
  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 text-right">{fond}</td>
      <td className="py-2 pr-4 text-right">{vente}</td>
      <td className="py-2 pr-4 text-right">{solde}</td>
      <td className="py-2 pr-4 text-right">{comptage}</td>
      <td className="py-2 text-right">{ecart}</td>
    </tr>
  );
}
