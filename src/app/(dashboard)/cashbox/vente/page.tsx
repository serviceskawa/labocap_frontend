"use client";

import { formatCFA } from "@/lib/utils";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Banknote, LockOpen } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxResponseDto,
  type CashboxOperationResponseDto,
} from "@/lib/api/cashbox";
import { banksApi, type Bank } from "@/lib/api/banks";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Schéma du dépôt bancaire
// ---------------------------------------------------------------------------

const depositSchema = z.object({
  bankId: z.string().min(1, "La banque est obligatoire"),
  amount: z.string().min(1, "Le montant est requis"),
  date: z.string().min(1, "La date est requise"),
  description: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositSchema>;

const depositInputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Libellés lisibles des modes de paiement (réplique le mapping de la vue Laravel).
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  CHEQUES: "Chèque",
  CHEQUE: "Chèque",
  MOBILEMONEY: "Mobile Money",
  VIREMENT: "Virement",
  CARTEBANCAIRE: "Carte bancaire",
};

function formatPaymentType(value: string | null): string {
  if (!value) return "—";
  return PAYMENT_TYPE_LABELS[value] ?? value;
}

// ---------------------------------------------------------------------------
// Page principale — Caisse de vente (réplique Laravel cashbox.vente.index)
// ---------------------------------------------------------------------------

export default function CashboxVentePage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // === Récupérer la caisse de vente
  const { data: cashboxesData } = useQuery({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
  });

  // Sélectionne la caisse de vente "principale". Des doublons vides peuvent exister
  // (artefacts de migration : même type, solde 0, aucune opération) ; prendre la
  // première ferait afficher une caisse vide. On retient donc, parmi les caisses de
  // type "vente", celle au solde le plus élevé (la caisse réellement active).
  const venteCashbox: CashboxResponseDto | undefined = (cashboxesData ?? [])
    .filter((c) => c.type === "vente")
    .reduce<CashboxResponseDto | undefined>(
      (best, c) => (!best || Number(c.balance ?? 0) > Number(best.balance ?? 0) ? c : best),
      undefined,
    );

  // === Opérations de la caisse de vente
  const { data: operationsData, isLoading } = useQuery({
    queryKey: ["cashbox-operations", { cashboxId: venteCashbox?.id, page, pageSize }],
    queryFn: () =>
      cashboxApi
        .getOperations({
          cashboxId: venteCashbox!.id,
          page,
          size: pageSize,
        })
        .then((r) => r.data),
    enabled: !!venteCashbox?.id,
  });

  // `?? []` crée un tableau neuf à chaque rendu : sans useMemo, toute dépendance
  // qui l'observe change en permanence.
  const allOperations = useMemo(
    () => operationsData?.content ?? [],
    [operationsData?.content]
  );

  // Filtrage local
  const operations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOperations;
    return allOperations.filter(
      (o) =>
        (o.description ?? "").toLowerCase().includes(q) ||
        String(o.amount).includes(q),
    );
  }, [allOperations, search]);

  const totalElements = operationsData?.totalElements ?? 0;
  const totalPages = operationsData?.totalPages ?? 0;

  // === Statut caisse — calque exact de Laravel (cashbox/vente/index.blade.php :
  // `@if ($cashboxs->statut == 0) [Fermée] @else [Ouvert]`). La source de vérité
  // est la colonne `statut` de la caisse de vente, PAS les sessions journalières
  // ni la date du jour. 1 = Ouvert, 0 = Fermée.
  const isOpen = venteCashbox?.statut === 1;

  // === Dépôt bancaire
  const queryClient = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  // Pièce jointe du dépôt (scan du reçu) — obligatoire, comme Laravel.
  const [depositFile, setDepositFile] = useState<File | null>(null);

  const depositForm = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      bankId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const { data: banksData } = useQuery<Bank[]>({
    queryKey: ["banks-all"],
    queryFn: () =>
      banksApi
        .findAll({ size: 1000 })
        .then((r) => (r.data as PageResponse<Bank>).content),
    enabled: can(PERMISSIONS.CREATE_BANKS),
    staleTime: 5 * 60_000,
  });
  const banks = banksData ?? [];

  const depositMutation = useMutation({
    mutationFn: (values: DepositFormData) =>
      banksApi.createDeposit(
        {
          bankId: values.bankId,
          amount: Number(values.amount),
          date: values.date,
          description: values.description || undefined,
        },
        depositFile,
      ),
    onSuccess: () => {
      // le solde caisse + l'historique des opérations changent
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-operations"] });
      toast.success("Dépôt bancaire enregistré");
      setDepositOpen(false);
      setDepositFile(null);
      depositForm.reset({
        bankId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de l'enregistrement du dépôt",
      );
    },
  });

  function openDeposit() {
    depositForm.reset({
      bankId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setDepositOpen(true);
  }

  // ---- Columns — alignées sur la vue Laravel « Caisse de vente » :
  // #, Montant, Facture, Type de payement, Date, Utilisateur.
  const columns: ColumnDef<CashboxOperationResponseDto>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {page * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {formatCFA(row.original.amount)}
        </span>
      ),
    },
    {
      header: "Facture",
      accessorKey: "invoiceCode",
      cell: ({ row }) =>
        row.original.invoiceCode ? (
          <span className="font-mono text-sm text-gray-700">
            {row.original.invoiceCode}
          </span>
        ) : (
          <span className="text-xs font-medium text-red-500">
            Sans facture
          </span>
        ),
    },
    {
      header: "Type de payement",
      accessorKey: "paymentType",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {formatPaymentType(row.original.paymentType)}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      header: "Utilisateur",
      accessorKey: "userName",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.userName ?? "—"}
        </span>
      ),
    },
  ];

  if (!can(PERMISSIONS.VIEW_CASHBOXES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisse de vente"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Trésorerie" },
          { label: "Caisse de vente" },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Dépôt bancaire — calque Laravel (vente/index.blade.php) : le bouton
                n'apparaît que lorsque la caisse est FERMÉE (statut == 0). */}
            {can(PERMISSIONS.CREATE_BANKS) && !isOpen && (
              <button
                type="button"
                onClick={openDeposit}
                disabled={!venteCashbox}
                className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="Enregistrer un dépôt bancaire"
              >
                <Banknote className="h-4 w-4" />
                Enregistrer un dépôt bancaire
              </button>
            )}
            {/* Ouverture/Fermeture */}
            <Link
              href="/cashbox/cashbox-daily"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LockOpen className="h-4 w-4" />
              Ouverture / Fermeture
            </Link>
          </div>
        }
      />

      {/* === KPI Solde actuel === */}
      {venteCashbox && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Solde actuel</p>
              <p className="mt-1 text-3xl font-bold text-green-700">
                {formatCFA(venteCashbox.balance)}
              </p>
            </div>
            <Link
              href="/cashbox/cashbox-daily"
              className="text-sm text-blue-600 hover:underline"
            >
              Voir toutes les sessions →
            </Link>
          </div>
        </div>
      )}

      {/* === Tableau historique des opérations === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Historique des opérations
          </h2>

          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {totalElements} opération{totalElements > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={operations}
          isLoading={isLoading}
          pageCount={totalPages}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
        />
      </div>

      {/* === Modal dépôt bancaire === */}
      <CrudModal
        isOpen={depositOpen}
        onClose={() => {
          setDepositOpen(false);
          setDepositFile(null);
          depositForm.reset();
        }}
        title="Enregistrer un dépôt bancaire"
        size="lg"
        onSubmit={depositForm.handleSubmit((v) => {
          // Laravel rend la pièce jointe obligatoire sur le dépôt.
          if (!depositFile) {
            toast.error("La pièce jointe (scan du reçu) est obligatoire.");
            return;
          }
          depositMutation.mutate(v);
        })}
        submitLabel="Enregistrer"
        isSubmitting={depositMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          {venteCashbox && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Solde caisse de vente :{" "}
              <span className="font-semibold text-gray-800">
                {formatCFA(venteCashbox.balance)}
              </span>{" "}
              — le montant déposé sera retiré de la caisse.
            </p>
          )}

          {/* Banque */}
          <RHFSelect
            control={depositForm.control}
            name="bankId"
            label="Banque"
            required
            options={banks.map((b) => ({
              value: b.id,
              label: `${b.name}${b.accountNumber ? ` (${b.accountNumber})` : ""}`,
            }))}
            placeholder="Rechercher une banque..."
            error={depositForm.formState.errors.bankId?.message}
          />

          {/* Montant */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Montant <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              {...depositForm.register("amount")}
              placeholder="0"
              className={depositInputClass}
            />
            {depositForm.formState.errors.amount && (
              <p className="text-xs text-red-500">
                {depositForm.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...depositForm.register("date")}
              className={depositInputClass}
            />
            {depositForm.formState.errors.date && (
              <p className="text-xs text-red-500">
                {depositForm.formState.errors.date.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              rows={3}
              {...depositForm.register("description")}
              placeholder="Référence / commentaire (optionnel)"
              className={`${depositInputClass} resize-none`}
            />
          </div>

          {/* Attachement — obligatoire (scan du reçu de dépôt), calque Laravel. */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Attachement <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setDepositFile(e.target.files?.[0] ?? null)}
              className={`${depositInputClass} file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100`}
            />
            <p className="text-xs text-gray-400">Scan du reçu de dépôt.</p>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
