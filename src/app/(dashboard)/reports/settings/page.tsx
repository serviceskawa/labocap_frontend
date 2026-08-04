"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, ArrowLeft, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { IconButton } from "@/components/ui/IconButton";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  titleReportsApi,
  type TitleReport,
  type TitleReportRequest,
} from "@/lib/api/reportSettings";
import { usersApi } from "@/lib/api/users";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";


type Tab = "titres" | "placeholder";

export default function ReportSettingsPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage =
    can(PERMISSIONS.EDIT_REPORTS) || can(PERMISSIONS.MANAGE_SETTINGS);

  const [tab, setTab] = useState<Tab>("titres");

  // === Onglet Titres ===
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TitleReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TitleReport | null>(null);
  // Message d'erreur du titre, affiché sous le champ au lieu du toast générique.
  const [titleError, setTitleError] = useState<string | null>(null);

  /** Valide le titre avant envoi. */
  function titreValide(nom: string): boolean {
    if (!nom.trim()) {
      setTitleError("Veuillez renseigner le titre");
      return false;
    }
    setTitleError(null);
    return true;
  }

  const [titleForm, setTitleForm] = useState<TitleReportRequest>({
    name: "",
    isDefault: false,
  });

  const titlesQuery = useQuery({
    queryKey: ["title-reports"],
    queryFn: () =>
      titleReportsApi.findAll({ size: 100 }).then((r) => r.data.content),
  });
  const allTitles = useMemo(
    () => titlesQuery.data ?? [],
    [titlesQuery.data]
  );

  const createMutation = useMutation({
    mutationFn: (data: TitleReportRequest) => titleReportsApi.create(data),
    onSuccess: () => {
      toast.success("Titre ajouté");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setCreateOpen(false);
      setTitleForm({ name: "", isDefault: false });
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TitleReportRequest }) =>
      titleReportsApi.update(id, data),
    onSuccess: () => {
      toast.success("Titre mis à jour");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setEditTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => titleReportsApi.delete(id),
    onSuccess: () => {
      toast.success("Titre supprimé");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  // Ouvre la modale d'édition en pré-remplissant le formulaire depuis la ligne
  // cliquée, plutôt que de le synchroniser après coup dans un effet.
  const openEdit = (target: TitleReport) => {
    setEditTarget(target);
    setTitleForm({ name: target.name, isDefault: target.isDefault });
  };

  // Colonnes du DataTable des titres (design partagé : recherche/pagination/toolbar intégrées)
  const titleColumns: ColumnDef<TitleReport>[] = [
    {
      header: "#",
      id: "index",
      cell: ({ row }) => <span className="text-gray-700">{row.index + 1}</span>,
    },
    {
      header: "Titres",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span
            className={
              row.original.isDefault ? "font-bold text-gray-900" : "text-gray-800"
            }
          >
            {row.original.name}
          </span>
          {row.original.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              <Star className="h-3 w-3 fill-current" />
              Par défaut
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) =>
        canManage ? (
          <div className="flex items-center gap-2">
            <IconButton
              variant="edit"
              title="Modifier"
              onClick={() => openEdit(row.original)}
              icon={<Pencil className="h-4 w-4" />}
            />
            <IconButton
              variant="delete"
              title="Supprimer"
              onClick={() => setDeleteTarget(row.original)}
              icon={<Trash2 className="h-4 w-4" />}
            />
          </div>
        ) : null,
    },
  ];

  // === Onglet Placeholder ===
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => usersApi.getSettings().then((r) => r.data),
  });
  const reportFooter = settingsQuery.data?.reportFooter ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres des comptes rendu"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendu", href: "/reports" },
          { label: "Paramètres" },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la liste des comptes rendu
            </Link>
            {canManage && tab === "titres" && (
              <button
                type="button"
                onClick={() => {
                  setTitleForm({ name: "", isDefault: false });
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un nouveau titre
              </button>
            )}
          </div>
        }
      />

      {/* Onglets pill */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("titres")}
          className={`rounded-full px-4 py-1.5 text-[.9rem] font-medium transition-colors ${
            tab === "titres"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Titres
        </button>
        <button
          type="button"
          onClick={() => setTab("placeholder")}
          className={`rounded-full px-4 py-1.5 text-[.9rem] font-medium transition-colors ${
            tab === "placeholder"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Placeholder
        </button>
      </div>

      {/* === Onglet Titres === */}
      {tab === "titres" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <DataTable
            columns={titleColumns}
            data={allTitles}
            isLoading={titlesQuery.isLoading}
            title="Liste des titres"
          />
        </div>
      )}

      {/* === Onglet Placeholder === */}
      {tab === "placeholder" && (
        <FooterPlaceholderCard
          key={reportFooter}
          initialValue={reportFooter}
          canManage={canManage}
        />
      )}

      {/* Modale création titre */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau titre"
        onSubmit={() =>
          titreValide(titleForm.name) && createMutation.mutate(titleForm)
        }
        submitLabel="Ajouter un nouveau titre"
        isSubmitting={createMutation.isPending}
      >
        <div className="space-y-4">
          <div className="text-right text-xs text-gray-500">
            <span className="text-red-500">*</span> champs obligatoires
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titleForm.name}
              onChange={(e) =>
                setTitleForm({
                  ...titleForm,
                  name: e.target.value.toUpperCase(),
                })
              }
              className={`${inputClass} uppercase`}
            />
            {titleError && (
              <p className="mt-1 text-sm text-red-600">{titleError}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Par défaut
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={titleForm.isDefault ?? false}
                onChange={(e) =>
                  setTitleForm({ ...titleForm, isDefault: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {titleForm.isDefault ? "oui" : "non"}
              </span>
            </label>
          </div>
        </div>
      </CrudModal>

      {/* Modale édition titre */}
      <CrudModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifier le titre"
        onSubmit={() =>
          editTarget &&
          titreValide(titleForm.name) &&
          updateMutation.mutate({ id: editTarget.id, data: titleForm })
        }
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titleForm.name}
              onChange={(e) =>
                setTitleForm({
                  ...titleForm,
                  name: e.target.value.toUpperCase(),
                })
              }
              className={`${inputClass} uppercase`}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Par défaut
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={titleForm.isDefault ?? false}
                onChange={(e) =>
                  setTitleForm({ ...titleForm, isDefault: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {titleForm.isDefault ? "oui" : "non"}
              </span>
            </label>
          </div>
        </div>
      </CrudModal>

      {/* Modale suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Supprimer ce titre"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer le titre "${deleteTarget.name}" ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// Le parent monte ce composant avec `key={reportFooter}` : toute nouvelle valeur
// venue du serveur le remonte et réinitialise l'état local, sans effet de synchro.
function FooterPlaceholderCard({
  initialValue,
  canManage,
}: {
  initialValue: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [footerValue, setFooterValue] = useState(initialValue);

  const saveFooterMutation = useMutation({
    mutationFn: () => usersApi.updateSettings({ reportFooter: footerValue }),
    onSuccess: () => {
      toast.success("Placeholder mis à jour");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-800">
        Placeholder du pied de page
      </h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Pied de page
          </label>
          <textarea
            value={footerValue}
            onChange={(e) => setFooterValue(e.target.value)}
            rows={8}
            className={inputClass}
            placeholder="Texte du placeholder (footer)..."
          />
        </div>
        {canManage && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveFooterMutation.mutate()}
              disabled={saveFooterMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveFooterMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {saveFooterMutation.isPending
                ? "Enregistrement..."
                : "Mettre à jour"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
