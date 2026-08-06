"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cashboxApi, type CashboxDailyResponseDto } from "@/lib/api/cashbox";
import { isPlaceholder, DEFAULT_APP_NAME } from "@/hooks/useBranding";
import { useAppSettings } from "@/hooks/useAppSettings";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

function formatFCFA(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
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
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
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
      {/* Logo du laboratoire en tête du reçu (calque print.blade). */}
      {logoSrc ? (
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt={appName} className="h-16 w-auto object-contain" />
        </div>
      ) : null}
      <h1 className="mb-6 text-center text-lg font-bold text-gray-900">
        {daily.code} — {formatDateTime(daily.createdAt)}
        {daily.updatedAt ? ` → ${formatDateTime(daily.updatedAt)}` : ""}
      </h1>

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
            fond={formatFCFA(opening)}
            vente={formatFCFA(cashCalc)}
            solde={formatFCFA(soldeEspeces)}
            comptage={formatFCFA(daily.cashConfirmation)}
            ecart={formatFCFA(daily.cashEcart)}
          />
          <Row
            label="Mobile Money"
            fond="-"
            vente={formatFCFA(daily.mobileMoneyCalculated)}
            solde="-"
            comptage={formatFCFA(daily.moneyMoneyConfirmation)}
            ecart={formatFCFA(daily.mobileMoneyEcart)}
          />
          <Row
            label="Chèque"
            fond="-"
            vente={formatFCFA(daily.chequeCalculated)}
            solde="-"
            comptage={formatFCFA(daily.chequeConfirmation)}
            ecart={formatFCFA(daily.chequeEcart)}
          />
          <Row
            label="Virement"
            fond="-"
            vente={formatFCFA(daily.virementCalculated)}
            solde="-"
            comptage={formatFCFA(daily.virementConfirmation)}
            ecart={formatFCFA(daily.virementEcart)}
          />
          <tr className="border-t-2 border-gray-400 font-bold">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4 text-right">{formatFCFA(opening)}</td>
            <td className="py-2 pr-4 text-right">{formatFCFA(daily.totalCalculated)}</td>
            <td className="py-2 pr-4 text-right">{formatFCFA(soldeEspeces)}</td>
            <td className="py-2 pr-4 text-right">{formatFCFA(daily.totalConfirmation)}</td>
            <td className="py-2 text-right">{formatFCFA(daily.totalEcart)}</td>
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
        SOLDE DE FERMETURE : {formatFCFA(daily.closingBalance)}
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
