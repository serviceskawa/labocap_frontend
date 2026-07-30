"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { FormField } from "@/components/ui/FormField";
import {
  signalsApi,
  signalTypeLabel,
  SIGNAL_TYPES,
  type Signal,
} from "@/lib/api/signals";
import type { ApiError } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// Calque `examens/signals/create.blade` : code de la demande, type, commentaire.
const schema = z.object({
  testOrderCode: z.string().min(1, { message: "Le code de la demande est requis" }),
  typeSignal: z.string().min(1, { message: "Le type de signal est requis" }),
  commentaire: z.string().min(1, { message: "Le commentaire est requis" }),
});
type FormValues = z.infer<typeof schema>;

export default function SignalementsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ["signals", { page, size: pageSize }],
    queryFn: () => signalsApi.findAll({ page, size: pageSize }).then((r) => r.data),
  });
  const signals: Signal[] = data?.content ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { testOrderCode: "", typeSignal: "", commentaire: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      // Le code part tel quel : c'est le serveur qui le résout en demande
      // d'examen, comme SignalController::store() en Laravel. La résolution
      // côté client passait par la recherche et échouait dès que celle-ci ne
      // ramenait pas le bon exact dans ses premiers résultats.
      signalsApi.create({
        testOrderCode: values.testOrderCode.trim(),
        typeSignal: values.typeSignal,
        commentaire: values.commentaire,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Problème signalé avec succès");
      setCreateOpen(false);
      form.reset();
    },
    onError: (err: AxiosError<ApiError> | Error) => {
      const message =
        err instanceof Error && !("response" in err)
          ? err.message
          : (err as AxiosError<ApiError>).response?.data?.message ??
            "Une erreur est survenue";
      toast.error(message);
    },
  });

  // Colonnes calquées sur `examens/signals/index.blade` :
  // #, Type de signal, Code examen, Commentaire, Envoyé par.
  const columns: ColumnDef<Signal>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => row.index + 1 + page * pageSize,
    },
    {
      header: "Type de signal",
      id: "type",
      cell: ({ row }) => signalTypeLabel(row.original.typeSignal),
    },
    {
      header: "Code examen",
      id: "code",
      cell: ({ row }) => row.original.testOrderCode ?? "—",
    },
    {
      header: "Commentaire",
      id: "commentaire",
      cell: ({ row }) => (
        <span
          className="block max-w-[280px] truncate"
          title={row.original.commentaire ?? ""}
        >
          {row.original.commentaire ?? ""}
        </span>
      ),
    },
    {
      header: "Envoyé par",
      id: "user",
      cell: ({ row }) => row.original.userName ?? "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Problèmes signalés"
        action={
          <button
            onClick={() => {
              form.reset();
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-[.15rem] bg-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] font-normal text-white transition-[background-color,box-shadow] hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]"
          >
            <AlertTriangle className="h-4 w-4" />
            Signaler un problème
          </button>
        }
      />

      <DataTableCard
        title="Liste des problèmes signalés"
        columns={columns}
        data={signals}
        isLoading={isLoading}
        pageCount={data?.totalPages ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(0);
        }}
      />

      {/* Modal — Signaler un problème (calque create.blade) */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Signaler un problème"
        contentClassName="max-w-[500px]"
        onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
        submitLabel="Signaler un problème"
        isSubmitting={createMutation.isPending}
      >
        <div className="space-y-4">
          <p className="mb-1 text-right">
            <span className="text-red-500">*</span>champs obligatoires
          </p>

          <FormField
            label="Code de la demande"
            required
            error={form.formState.errors.testOrderCode?.message}
          >
            <input
              type="text"
              {...form.register("testOrderCode")}
              placeholder="XX-XXXX"
              className={inputClass}
            />
          </FormField>

          <FormField
            label="Type de signal"
            required
            error={form.formState.errors.typeSignal?.message}
          >
            <select {...form.register("typeSignal")} className={inputClass}>
              <option value="">Sélectionner un type de signal</option>
              {SIGNAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Commentaire"
            required
            error={form.formState.errors.commentaire?.message}
          >
            <textarea
              {...form.register("commentaire")}
              rows={6}
              placeholder="Décrivez le problème rencontré…"
              className={`${inputClass} resize-none`}
            />
          </FormField>
        </div>
      </CrudModal>
    </div>
  );
}
