"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import { Button } from "@/components/ui/Button";
import {
  loadTestOrderOptions,
  type TestOrderOption,
} from "@/lib/api/optionLoaders";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { IconButton } from "@/components/ui/IconButton";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  assignmentsApi,
  type AssignmentDetail,
  type AssignmentPrint,
} from "@/lib/api/assignments";
import { usersApi, type User } from "@/lib/api/users";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function isDoctorRole(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("docteur") ||
    n.includes("doctor") ||
    n.includes("medecin") ||
    n.includes("médecin") ||
    n.includes("anapath") ||
    n.includes("anatomopath")
  );
}

interface UpdateForm {
  userId: string;
  date: string;
  note: string;
}

/**
 * Demandes validées, cherchées côté serveur. On demande plus que les 6 lignes
 * affichées : certaines seront écartées (déjà affectées à ce bordereau).
 */
const loadValidatedOrders = loadTestOrderOptions({
  status: "VALIDATED",
  size: 20,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssignmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const canManage = can(PERMISSIONS.MANAGE_TEST_ORDER_ASSIGNMENTS);

  // ---- Form mise à jour ----------------------------------------------------

  const {
    register,
    control,
    handleSubmit,
    reset,
  } = useForm<UpdateForm>({
    defaultValues: { userId: "", date: "", note: "" },
  });

  // ---- Ajout détail
  const [selectedOrder, setSelectedOrder] = useState<TestOrderOption | null>(
    null
  );
  const [detailNote, setDetailNote] = useState("");

  // ---- Modal suppression
  const [detailToDelete, setDetailToDelete] = useState<AssignmentDetail | null>(
    null
  );

  // ---- Queries -------------------------------------------------------------

  const { data: printData, isLoading } = useQuery<AssignmentPrint>({
    queryKey: ["assignment", id],
    queryFn: () => assignmentsApi.getPrint(id as string).then((r) => r.data),
    enabled: !!id,
  });

  const assignment = printData?.assignment;
  const details = useMemo<AssignmentDetail[]>(
    () => printData?.details ?? [],
    [printData]
  );

  // ---- Pagination locale du tableau des détails ----------------------------
  // Contrôles mutualisés avec `DataTable` : une seule apparence de pagination.

  const detailsPagination = useTablePagination(details);

  // Docteurs
  const { data: usersData } = useQuery({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi.findAll({ size: 500 }).then((r) => r.data.content as User[]),
  });
  const doctors = useMemo(
    () =>
      (usersData ?? []).filter((u) =>
        (u.roles ?? []).some((r) => isDoctorRole(r.name))
      ),
    [usersData]
  );

  const assignedOrderIds = useMemo(
    () => new Set(details.map((d) => d.testOrderId)),
    [details]
  );

  // Demandes VALIDATED : cherchées en base (14 000 en tout), en écartant celles
  // déjà présentes sur ce bordereau.
  const loadOrderOptions = useCallback(
    (input: string) =>
      loadValidatedOrders(input).then((opts) =>
        opts.filter((o) => !assignedOrderIds.has(o.value))
      ),
    [assignedOrderIds]
  );

  // ---- Initialisation form après chargement --------------------------------

  useEffect(() => {
    if (assignment) {
      reset({
        userId: assignment.userId ?? "",
        date: assignment.date
          ? assignment.date.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        note: assignment.note ?? "",
      });
    }
  }, [assignment, reset]);

  // ---- Mutations -----------------------------------------------------------

  const updateMutation = useMutation({
    mutationFn: (values: UpdateForm) =>
      assignmentsApi.update(id as string, {
        userId: values.userId,
        date: values.date || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      toast.success("Affectation mise à jour");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la mise à jour"
      );
    },
  });

  const addDetailMutation = useMutation({
    mutationFn: (data: { testOrderId: string; note?: string }) =>
      assignmentsApi.addDetail(id as string, data),
    onSuccess: () => {
      toast.success("Demande d'examen ajoutée");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setSelectedOrder(null);
      setDetailNote("");
    },
    onError: (err: AxiosError<ApiError>) => {
      const status = err.response?.status;
      if (status === 409) {
        toast.error("Cette demande d'examen est déjà affectée");
      } else {
        toast.error(
          err.response?.data?.message ?? "Erreur lors de l'ajout"
        );
      }
    },
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) => assignmentsApi.deleteDetail(detailId),
    onSuccess: () => {
      toast.success("Détail supprimé");
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setDetailToDelete(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // ---- Handlers ------------------------------------------------------------

  const onSubmitUpdate = (values: UpdateForm) => {
    if (!values.userId) {
      toast.error("Veuillez sélectionner un docteur");
      return;
    }
    updateMutation.mutate(values);
  };

  const handleAddDetail = () => {
    if (!selectedOrder) {
      toast.error("Veuillez sélectionner une demande d'examen");
      return;
    }
    addDetailMutation.mutate({
      testOrderId: selectedOrder.value,
      note: detailNote || undefined,
    });
  };

  // ---- Guard ---------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas la permission de consulter les affectations.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Affectation introuvable.</p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Affectation ${assignment.code}`}
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Affectations", href: "/test-orders/assignments" },
          { label: assignment.code },
        ]}
        action={
          <Link
            href="/test-orders/assignments"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste des affectations
          </Link>
        }
      />

      {/* Form principal englobant tout (comme Laravel) */}
      <form onSubmit={handleSubmit(onSubmitUpdate)} className="space-y-6">

        {/* Section 1 : Informations affectation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Informations
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <RHFSelect
              control={control}
              name="userId"
              label="Docteur"
              required
              options={doctors.map((d) => ({
                value: d.id,
                label: `${d.firstname} ${d.lastname}`,
              }))}
              placeholder="Sélectionner le docteur"
              isDisabled={!canManage}
            />

            <div>
              <label
                htmlFor="date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                {...register("date")}
                disabled={!canManage}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="note"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Note
            </label>
            <textarea
              id="note"
              rows={5}
              {...register("note")}
              disabled={!canManage}
              className={inputClass}
            />
          </div>
        </div>

        {/* Section 2 : Liste des demandes d'examens affectées */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h5 className="font-medium text-gray-800">
              Liste des demandes d&apos;examens affectées
            </h5>
          </div>

          <div className="p-5">
            {/* Ajout détail — formulaire indépendant (pas submit) */}
            {canManage && (
              <div className="mb-6 grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Code{" "}
                    <span className="text-xs uppercase text-gray-400">
                      [Demande d&apos;examen/Reférence]
                    </span>
                  </label>
                  <RemoteSelectField<TestOrderOption>
                    id="assignment-test-order"
                    loadOptions={loadOrderOptions}
                    value={selectedOrder?.value ?? null}
                    onChange={(_v, opt) => setSelectedOrder(opt)}
                    selectedOption={selectedOrder}
                    isClearable
                    placeholder="Rechercher une demande d'examen (code, patient)"
                    className="text-sm"
                  />
                </div>

                <div className="md:col-span-4">
                  <label
                    htmlFor="detail-note"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Note
                  </label>
                  <input
                    id="detail-note"
                    type="text"
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddDetail}
                    disabled={addDetailMutation.isPending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addDetailMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {addDetailMutation.isPending ? "Ajout..." : "Ajouter"}
                  </button>
                </div>
              </div>
            )}

            {/* Tableau des détails — contrôles de pagination partagés
                (voir `TablePagination`), identiques à ceux du `DataTable`. */}
            <TableLengthControl pagination={detailsPagination} />
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Demande d&apos;examen
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Note
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {details.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-sm text-gray-500"
                        >
                          Aucune demande d&apos;examen affectée
                        </td>
                      </tr>
                    ) : (
                      detailsPagination.pageRows.map((d, idx) => (
                        <tr
                          key={d.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-gray-700">
                            {detailsPagination.offset + idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium text-gray-800">
                              {d.testOrderCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {d.note ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {canManage && (
                              <IconButton
                                variant="delete"
                                title="Supprimer"
                                aria-label="Supprimer"
                                onClick={() => setDetailToDelete(d)}
                                icon={<Trash2 className="h-4 w-4" />}
                              />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <TablePaginationFooter pagination={detailsPagination} />

            {/* Bouton Soumettre full-width vert (comme Laravel : btn w-100 btn-success) */}
            {canManage && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <Button type="submit" className="w-full py-3" loading={updateMutation.isPending}>
                  {updateMutation.isPending ? "Enregistrement..." : "Soumettre"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Modal de confirmation */}
      <ConfirmModal
        isOpen={!!detailToDelete}
        onClose={() => setDetailToDelete(null)}
        onConfirm={() =>
          detailToDelete && deleteDetailMutation.mutate(detailToDelete.id)
        }
        title="Supprimer cette affectation"
        message={
          detailToDelete
            ? `Voulez-vous vraiment retirer la demande "${detailToDelete.testOrderCode}" de cette affectation ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDetailMutation.isPending}
      />
    </div>
  );
}
