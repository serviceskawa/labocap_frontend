"use client";

import { formatCFA } from "@/lib/utils";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Lock, Printer } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { cashboxApi } from "@/lib/api/cashbox";
import { formatDate } from "@/lib/utils";
import type { ApiError } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

const readonlyClass = `${inputClass} bg-gray-50 text-gray-600`;


// Modes de paiement dans l'ordre Laravel, avec la clé paymentType côté opérations.
const MODES = [
  { key: "cash", label: "Espèces", paymentType: "ESPECES" },
  { key: "mm", label: "Mobile Money", paymentType: "MOBILEMONEY" },
  { key: "cheque", label: "Chèques", paymentType: "CHEQUES" },
  { key: "virement", label: "Virement", paymentType: "VIREMENT" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Page — Fermeture de caisse, assistant 2 étapes (réplique cashbox_daily.fermeture)
// ---------------------------------------------------------------------------

export default function CashboxFermeturePage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [counted, setCounted] = useState<Record<ModeKey, string>>({
    cash: "",
    mm: "",
    cheque: "",
    virement: "",
  });
  const [comment, setComment] = useState("");

  // ---- Données ----
  const { data: session } = useQuery({
    queryKey: ["cashbox-daily", id],
    queryFn: () => cashboxApi.getDaily(id).then((r) => r.data),
  });

  // Montants calculés par mode depuis l'ouverture de LA session qu'on ferme.
  // Sans cet identifiant, le serveur repart de la dernière session ouverte de
  // la branche : en fermant celle du jour alors qu'une session plus ancienne
  // traîne, le total couvrait toute la période écoulée depuis celle-ci.
  const { data: summary } = useQuery({
    queryKey: ["cashbox-dailies-summary", id],
    queryFn: () => cashboxApi.getDailiesSummary(id).then((r) => r.data),
  });



  // Les nombres viennent du résumé, comme les montants.
  //
  // Ils étaient auparavant comptés sur les opérations de caisse, filtrées sur
  // la seule date de la session — deux sources et deux fenêtres différentes de
  // celles du montant affiché juste à côté. Une caisse ouverte depuis plusieurs
  // jours montrait « 0 » en face de plusieurs millions.
  const counts: Record<ModeKey, number> = {
    cash: summary?.nombreEspeces ?? 0,
    mm: summary?.nombreMobileMoney ?? 0,
    cheque: summary?.nombreCheques ?? 0,
    virement: summary?.nombreVirement ?? 0,
  };

  const calculated: Record<ModeKey, number> = {
    cash: summary?.totalEspeces ?? 0,
    mm: summary?.totalMobileMoney ?? 0,
    cheque: summary?.totalCheques ?? 0,
    virement: summary?.totalVirement ?? 0,
  };

  const opening = session?.openingBalance ?? 0;

  // ---- Calculs ----
  const countedNum = (k: ModeKey) => Number(counted[k]) || 0;

  // Écart = compté MOINS calculé, sens du legacy
  // (cashbox_daily/fermeture.blade.php : `totalConfirmation - totalCalculated`).
  // Le sens compte doublement : il porte l'information — négatif quand il
  // manque de l'argent, positif quand il y en a en trop — et le backend
  // l'ajoute au solde de la caisse à la clôture. Inversé, il déplaçait ce solde
  // dans le mauvais sens.
  const ecart = (k: ModeKey) => countedNum(k) - calculated[k];

  const totalCalculated =
    calculated.cash + calculated.mm + calculated.cheque + calculated.virement;
  const totalCounted =
    countedNum("cash") + countedNum("mm") + countedNum("cheque") + countedNum("virement");
  const totalEcart = totalCounted - totalCalculated;

  // Solde de fermeture = fond initial + total compté, TOUS MODES CONFONDUS
  // (legacy : `close_balance = open_money + totalConfirmation`).
  //
  // Ne retenir que les espèces laissait la colonne à zéro dès qu'une journée
  // était encaissée en Mobile Money — le cas courant ici, où l'essentiel des
  // règlements passe par ce canal.
  const closingBalance = opening + totalCounted;

  const allCountedFilled = MODES.every((m) => counted[m.key] !== "");

  // ---- Mutation ----
  const closeMutation = useMutation({
    mutationFn: () =>
      cashboxApi.closeDaily(id, {
        closingBalance,
        cashCalculated: calculated.cash,
        cashConfirmation: countedNum("cash"),
        cashEcart: ecart("cash"),
        mobileMoneyCalculated: calculated.mm,
        moneyMoneyConfirmation: countedNum("mm"),
        mobileMoneyEcart: ecart("mm"),
        chequeCalculated: calculated.cheque,
        chequeConfirmation: countedNum("cheque"),
        chequeEcart: ecart("cheque"),
        virementCalculated: calculated.virement,
        virementConfirmation: countedNum("virement"),
        virementEcart: ecart("virement"),
        totalCalculated,
        totalConfirmation: totalCounted,
        totalEcart,
        description: comment.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-dailies"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-daily", id] });
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      toast.success("Caisse clôturée avec succès");
      router.push("/cashbox/cashbox-daily");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la fermeture"),
  });

  function goToStep2() {
    if (!allCountedFilled) {
      toast.error("Veuillez renseigner le montant compté pour chaque mode.");
      return;
    }
    setStep(2);
  }

  function handleConfirm() {
    if (totalEcart !== 0 && !comment.trim()) {
      toast.error("Un commentaire est requis lorsqu'il existe un écart.");
      return;
    }
    closeMutation.mutate();
  }

  const alreadyClosed = session && session.status === 0;

  return (
    <PermissionGate
      permission={PERMISSIONS.EDIT_CASHBOX_DAILIES}
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Accès non autorisé.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Opération de fermeture de la caisse"
          breadcrumbs={[
            { label: "Trésorerie" },
            { label: "Ouverture et fermeture", href: "/cashbox/cashbox-daily" },
            { label: "Fermeture" },
          ]}
          action={
            <Link
              href="/cashbox/cashbox-daily"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          }
        />

        {alreadyClosed ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Cette session est déjà clôturée.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {/*
              La période comptée, énoncée. Les montants proposés couvrent tout
              l'intervalle depuis l'ouverture de cette session — plusieurs jours
              si elle est restée ouverte. Sans cette mention, un caissier ayant
              encaissé 876 000 et voyant deux millions doute de son comptage
              plutôt que de la période.
            */}
            {summary?.depuis && (
              <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900">
                Montants encaissés depuis l&apos;ouverture de cette caisse, le{" "}
                <span className="font-semibold">{formatDate(summary.depuis)}</span>.
              </p>
            )}

            {/* Onglets / étapes */}
            <div className="mb-6 flex items-center gap-2">
              <StepPill active={step === 1} done={step === 2} index={1} label="Comptage" icon={<Calculator className="h-4 w-4" />} />
              <div className="h-px flex-1 bg-gray-200" />
              <StepPill active={step === 2} done={false} index={2} label="Mise en coffre" icon={<Lock className="h-4 w-4" />} />
            </div>

            {/* ---- Étape 1 : Comptage ---- */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="py-2.5 pl-4 pr-3">Mode de paiement</th>
                        <th className="px-3 py-2.5 text-right">Nombre</th>
                        <th className="px-3 py-2.5 text-right">Montant calculé</th>
                        <th className="px-3 py-2.5">Montant compté</th>
                        <th className="py-2.5 pl-3 pr-4 text-right">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MODES.map((m) => (
                        <tr key={m.key}>
                          <td className="py-3 pl-4 pr-3 font-medium text-gray-700">
                            {m.label}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600">
                            {counts[m.key]}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-800">
                            {formatCFA(calculated[m.key])}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={counted[m.key]}
                              onChange={(e) =>
                                setCounted((prev) => ({
                                  ...prev,
                                  [m.key]: e.target.value,
                                }))
                              }
                              placeholder="0"
                              className={inputClass}
                            />
                          </td>
                          <td
                            className={`py-3 pl-3 pr-4 text-right font-medium ${
                              ecart(m.key) !== 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {formatCFA(ecart(m.key))}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="py-3 pl-4 pr-3 text-gray-800">Total</td>
                        <td />
                        <td className="px-3 py-3 text-right text-gray-800">
                          {formatCFA(totalCalculated)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-800">
                          {formatCFA(totalCounted)}
                        </td>
                        <td
                          className={`py-3 pl-3 pr-4 text-right ${
                            totalEcart !== 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {formatCFA(totalEcart)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {!allCountedFilled && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Renseignez le montant compté pour chaque mode de paiement avant de continuer.
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={goToStep2}
                    disabled={!allCountedFilled}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* ---- Étape 2 : Mise en coffre ---- */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="py-2.5 pl-4 pr-3">Mode de paiement</th>
                        <th className="px-3 py-2.5 text-right">Fond initial</th>
                        <th className="px-3 py-2.5 text-right">Vente</th>
                        <th className="px-3 py-2.5 text-right">Solde</th>
                        <th className="px-3 py-2.5 text-right">Comptage</th>
                        <th className="py-2.5 pl-3 pr-4 text-right">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-3 pl-4 pr-3 font-medium text-gray-700">Espèces</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCFA(opening)}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCFA(calculated.cash)}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCFA(opening + calculated.cash)}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCFA(countedNum("cash"))}</td>
                        <td className={`py-3 pl-3 pr-4 text-right font-medium ${ecart("cash") !== 0 ? "text-red-600" : "text-green-600"}`}>{formatCFA(ecart("cash"))}</td>
                      </tr>
                      {MODES.filter((m) => m.key !== "cash").map((m) => (
                        <tr key={m.key}>
                          <td className="py-3 pl-4 pr-3 font-medium text-gray-700">{m.label}</td>
                          <td className="px-3 py-3 text-right text-gray-400">-</td>
                          <td className="px-3 py-3 text-right text-gray-700">{formatCFA(calculated[m.key])}</td>
                          <td className="px-3 py-3 text-right text-gray-400">-</td>
                          <td className="px-3 py-3 text-right text-gray-700">{formatCFA(countedNum(m.key))}</td>
                          <td className={`py-3 pl-3 pr-4 text-right font-medium ${ecart(m.key) !== 0 ? "text-red-600" : "text-green-600"}`}>{formatCFA(ecart(m.key))}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="py-3 pl-4 pr-3 text-gray-800">Total</td>
                        <td className="px-3 py-3 text-right text-gray-800">{formatCFA(opening)}</td>
                        <td className="px-3 py-3 text-right text-gray-800">{formatCFA(totalCalculated)}</td>
                        <td className="px-3 py-3 text-right text-gray-800">{formatCFA(opening + calculated.cash)}</td>
                        <td className="px-3 py-3 text-right text-gray-800">{formatCFA(totalCounted)}</td>
                        <td className={`py-3 pl-3 pr-4 text-right ${totalEcart !== 0 ? "text-red-600" : "text-green-600"}`}>{formatCFA(totalEcart)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Solde de fermeture */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Solde de fermeture
                  </label>
                  <input
                    type="text"
                    value={formatCFA(closingBalance)}
                    readOnly
                    className={`${readonlyClass} max-w-xs`}
                  />
                </div>

                {/* Commentaire */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Commentaire {totalEcart !== 0 && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      totalEcart !== 0
                        ? "Justifiez l'écart constaté…"
                        : "Commentaire (optionnel)"
                    }
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <div className="flex items-center gap-2">
                    {/* Bouton « Imprimer » (calque Laravel étape 2) : ouvre la page
                        d'impression de la session dans un nouvel onglet. */}
                    <Link
                      href={`/cashbox/cashbox-daily/print/${id}`}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimer
                    </Link>
                    <Button
                      onClick={handleConfirm}
                      loading={closeMutation.isPending}
                      icon={<Lock className="h-4 w-4" />}
                      className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium hover:bg-green-700 hover:shadow-[0_2px_6px_0_rgba(10,207,151,0.5)]"
                    >
                      Confirmer et fermer la caisse
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}

// ---------------------------------------------------------------------------
// Pastille d'étape
// ---------------------------------------------------------------------------

function StepPill({
  active,
  done,
  index,
  label,
  icon,
}: {
  active: boolean;
  done: boolean;
  index: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[.9rem] font-medium ${
        active
          ? "bg-blue-600 text-white"
          : done
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-500"
      }`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
        {index}
      </span>
      {icon}
      {label}
    </div>
  );
}
