"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  reportTemplatesApi,
  type ReportTemplate,
  type ReportTemplateRequest,
} from "@/lib/api/reportTemplates";
import type { ApiError } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function ReportTemplatesPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can(PERMISSIONS.MANAGE_SETTINGS);

  // === État
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReportTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null);
  const [form, setForm] = useState<ReportTemplateRequest>({
    title: "",
    content: "",
    footer: "",
  });
  const [search, setSearch] = useState("");

  // === Query
  const templatesQuery = useQuery({
    queryKey: ["report-templates"],
    queryFn: () =>
      reportTemplatesApi.findAll({ size: 100 }).then((r) => r.data.content),
  });
  const allTemplates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data]
  );

  const templates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter((t) =>
      (t.title ?? t.name ?? "").toLowerCase().includes(q),
    );
  }, [allTemplates, search]);

  // Erreur de saisie du titre, affichée sous le champ plutôt que dans un toast
  // générique « Erreurs de validation ».
  const [titleError, setTitleError] = useState<string | null>(null);

  /** Valide le titre avant envoi. Renvoie false et affiche le message si vide. */
  function titreValide(): boolean {
    if (!form.title.trim()) {
      setTitleError("Veuillez renseigner le titre du template");
      return false;
    }
    setTitleError(null);
    return true;
  }

  // === Mutations
  const createMutation = useMutation({
    mutationFn: (data: ReportTemplateRequest) =>
      reportTemplatesApi.create(data),
    onSuccess: () => {
      toast.success("Template ajouté");
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      setCreateOpen(false);
      setForm({ title: "", content: "", footer: "" });
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReportTemplateRequest }) =>
      reportTemplatesApi.update(id, data),
    onSuccess: () => {
      toast.success("Template mis à jour");
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      setEditTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportTemplatesApi.delete(id),
    onSuccess: () => {
      toast.success("Template supprimé");
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  // Ouvre la modale d'édition en pré-remplissant le formulaire depuis la ligne
  // cliquée, plutôt que de le synchroniser après coup dans un effet.
  const openEdit = (target: ReportTemplate) => {
    setEditTarget(target);
    setForm({
      title: target.title ?? target.name ?? "",
      content: target.content ?? target.header ?? "",
      footer: target.footer ?? "",
      description: target.description ?? "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de comptes rendu"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendu", href: "/reports" },
          { label: "Templates" },
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
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setForm({ title: "", content: "", footer: "" });
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un nouveau template
              </button>
            )}
          </div>
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Liste des templates
          </h2>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un template..."
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
            <thead className="border-b-2 border-gray-300 bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800 w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800 w-48">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templatesQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Chargement...
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Aucun template
                  </td>
                </tr>
              ) : (
                templates.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {t.title ?? t.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <IconButton
                            variant="edit"
                            title="Modifier"
                            onClick={() => openEdit(t)}
                            icon={<Pencil className="h-4 w-4" />}
                          />
                          <IconButton
                            variant="delete"
                            title="Supprimer"
                            onClick={() => setDeleteTarget(t)}
                            icon={<Trash2 className="h-4 w-4" />}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau template"
        size="xl"
        onSubmit={() => titreValide() && createMutation.mutate(form)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <TemplateForm form={form} setForm={setForm} titleError={titleError} />
      </CrudModal>

      {/* Modale édition */}
      <CrudModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifier le template"
        size="xl"
        onSubmit={() =>
          titreValide() &&
          editTarget &&
          updateMutation.mutate({ id: editTarget.id, data: form })
        }
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <TemplateForm form={form} setForm={setForm} titleError={titleError} />
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        title="Supprimer ce template"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer le template "${deleteTarget.title ?? deleteTarget.name ?? ""}" ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : formulaire template
// ---------------------------------------------------------------------------

function TemplateForm({
  titleError,
  form,
  setForm,
}: {
  form: ReportTemplateRequest;
  setForm: (f: ReportTemplateRequest) => void;
  titleError?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Titre du template <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputClass}
          placeholder="Ex : Structure CR, Tête fémorale, Amygdale..."
        />
        {titleError && (
          <p className="mt-1 text-sm text-red-600">{titleError}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Contenu
        </label>
        <textarea
          value={form.content ?? ""}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={12}
          className={inputClass + " font-mono text-xs"}
          placeholder="HTML du template (ex : <h4>TITRE DU COMPTE RENDU</h4>...)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Vous pouvez utiliser du HTML pour la mise en forme.
        </p>
      </div>
    </div>
  );
}
