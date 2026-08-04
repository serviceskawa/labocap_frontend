"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { SelectField } from "@/components/ui/SelectField";
import { docsApi, documentationCategoriesApi, formatFileSize } from "@/lib/api/docs";
import type { ApiError } from "@/types/api";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocCreatePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ title?: string; file?: string }>({});

  // Catégories
  const { data: categories } = useQuery({
    queryKey: ["documentation-categories"],
    queryFn: () => documentationCategoriesApi.findAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, file, categoryId }: { title: string; file: File; categoryId?: string }) =>
      docsApi.create(title, file, categoryId || undefined),
    onSuccess: (res) => {
      toast.success("Document créé avec succès");
      router.push(`/docs/${res.data.id}`);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const validate = () => {
    const errs: { title?: string; file?: string } = {};
    if (!title.trim()) errs.title = "Le titre est requis";
    if (!file) errs.file = "Un fichier est requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !file) return;
    createMutation.mutate({ title: title.trim(), file, categoryId });
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouveau document"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Documents", href: "/docs" },
          { label: "Nouveau" },
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Titre */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du document"
              className={inputClass}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* Catégorie */}
          <SelectField
            label="Catégorie"
            placeholder="Rechercher une catégorie..."
            options={(categories ?? []).map((cat) => ({
              value: cat.id,
              label: cat.name,
            }))}
            value={categoryId || null}
            onChange={(v) => setCategoryId(v ?? "")}
            isClearable
          />

          {/* Fichier */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Fichier <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.doc,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
            {errors.file && <p className="text-xs text-red-500">{errors.file}</p>}
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
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createMutation.isPending ? "Enregistrement..." : "Créer le document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
