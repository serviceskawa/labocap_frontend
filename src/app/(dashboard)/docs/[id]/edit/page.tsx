"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { docsApi, formatFileSize } from "@/lib/api/docs";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Page — Ajouter une nouvelle version
// ---------------------------------------------------------------------------

export default function DocAddVersionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ["doc", id],
    queryFn: () => docsApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  const addVersionMutation = useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) =>
      docsApi.addVersion(id, file, title || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc", id] });
      queryClient.invalidateQueries({ queryKey: ["doc-versions", id] });
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      toast.success("Nouvelle version ajoutée avec succès");
      router.push(`/docs/${id}`);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'ajout de version");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError("Un fichier est requis");
      return;
    }
    setFileError("");
    addVersionMutation.mutate({ file, title });
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle version"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Documents", href: "/docs" },
          ...(doc ? [{ label: doc.title, href: `/docs/${id}` }] : []),
          { label: "Nouvelle version" },
        ]}
      />

      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {docLoading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded bg-gray-200" />
            ))}
          </div>
        ) : !doc ? (
          <p className="text-center py-8 text-sm text-gray-500">Document introuvable.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-sm text-gray-600">
              Ajout d&apos;une nouvelle version pour le document :{" "}
              <span className="font-semibold text-gray-900">{doc.title}</span>
            </p>

            {/* Titre de version */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Titre de la version (optionnel)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. : Révision 2025, Mise à jour protocole…"
                className={inputClass}
              />
            </div>

            {/* Fichier */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Fichier <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.doc,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFileError("");
                }}
                className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100`}
              />
              {file && (
                <p className="text-xs text-gray-500">
                  {file.name} ({formatFileSize(file.size)})
                </p>
              )}
              <p className="text-xs text-gray-400">
                Formats acceptés : PDF, JPG, PNG, GIF, WEBP, DOCX, XLSX
              </p>
              {fileError && <p className="text-xs text-red-500">{fileError}</p>}
            </div>

            {/* Boutons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={addVersionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {addVersionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {addVersionMutation.isPending ? "Enregistrement..." : "Ajouter la version"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
