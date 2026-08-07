"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Printer,
  SquareArrowOutUpRight,
} from "lucide-react";
import { LimitedSelect as Select } from "@/components/ui/LimitedSelect";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { AuthThumbnail } from "@/components/ui/AuthThumbnail";
import { QRCodeSVG } from "qrcode.react";
import { PermissionGate } from "@/components/common/PermissionGate";
import {
  TableLengthControl,
  TablePaginationFooter,
  useTablePagination,
} from "@/components/common/TablePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import { reportsApi, type ReportDetail } from "@/lib/api/reports";
import { reportTemplatesApi } from "@/lib/api/reportTemplates";
import { titleReportsApi } from "@/lib/api/reportSettings";
import { usersApi } from "@/lib/api/users";
import { tagsApi } from "@/lib/api/tags";
import { patientsApi } from "@/lib/api/patients";
import { testOrdersApi, type ImageDto } from "@/lib/api/testOrders";
import { openDocFile } from "@/lib/api/docs";
import type { ApiError } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const reportEditSchema = z.object({
  titleId: z.string().optional(),
  content: z.string().optional(),
  contentMicro: z.string().optional(),
  descriptionSupplementaire: z.string().optional(),
  descriptionSupplementaireMicro: z.string().optional(),
  comment: z.string().optional(),
  commentSup: z.string().optional(),
  receiverName: z.string().optional(),
  signatory1Id: z.string().optional(),
  signatory2Id: z.string().optional(),
  signatory3Id: z.string().optional(),
  reviewedById: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

type ReportEditFormValues = z.infer<typeof reportEditSchema>;

// ---------------------------------------------------------------------------
// Helpers de style (réplique des « card » Laravel avec le design du projet)
// ---------------------------------------------------------------------------


const textareaClass =
  "w-full p-3 border border-gray-300 rounded text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y";

const labelClass = "text-sm font-medium text-gray-700";

/** Carte à en-tête façon Laravel (`<h5 class="card-header">`). */
function Card({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className ?? ""}`}>
      {title && (
        <div className="border-b border-gray-200 px-5 py-3 text-base font-semibold text-gray-800">
          {title}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- Etat du compte rendu (select Laravel : 0 = En attente / 1 = Terminé)
  const [statusValue, setStatusValue] = useState<"0" | "1">("0");
  // --- Affichage du bloc « Contenu complémentaire » (switch Laravel)
  const [showComplementaire, setShowComplementaire] = useState(false);

  // --- Query rapport
  const { data: report, isLoading } = useQuery<ReportDetail>({
    queryKey: ["report", id],
    queryFn: () => reportsApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  // Historique des opérations du compte rendu, paginé comme les autres tableaux.
  const logsPagination = useTablePagination(report?.logs ?? []);

  // --- Bon d'examen lié (patient + galerie)
  const { data: testOrder } = useQuery({
    queryKey: ["report-test-order", report?.testOrderId],
    queryFn: () => testOrdersApi.findById(report!.testOrderId).then((r) => r.data),
    enabled: !!report?.testOrderId,
    staleTime: 5 * 60_000,
  });

  // --- Profil patient (Nom / Code / Téléphone)
  const { data: patientProfile } = useQuery({
    queryKey: ["report-patient", testOrder?.patientId],
    queryFn: () => patientsApi.findById(testOrder!.patientId).then((r) => r.data),
    enabled: !!testOrder?.patientId,
    staleTime: 5 * 60_000,
  });

  // --- Galerie d'images de la demande (pièces jointes)
  const { data: galleryImages } = useQuery<ImageDto[]>({
    queryKey: ["report-order-images", report?.testOrderId],
    queryFn: () => testOrdersApi.getImages(report!.testOrderId).then((r) => r.data),
    enabled: !!report?.testOrderId,
    staleTime: 5 * 60_000,
  });

  // --- Utilisateurs (signataires / relecteur)
  const { data: usersData } = useQuery({
    queryKey: ["users-for-report"],
    queryFn: () => usersApi.findAll({ size: 200 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const userOptions = (usersData ?? []).map((u) => ({
    value: u.id,
    label: `${u.lastname} ${u.firstname}`.trim(),
  }));

  // --- Tags
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.findAll().then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const tagOptions = (tagsData ?? []).map((t) => ({ value: t.id, label: t.name }));

  // --- Titres du compte rendu
  const { data: titlesData } = useQuery({
    queryKey: ["title-reports"],
    queryFn: () => titleReportsApi.findAll({ size: 200 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const titleOptions = (titlesData ?? []).map((t) => ({ value: t.id, label: t.name }));

  // --- Modèles / templates (« modèle d'expression »)
  const { data: templatesData } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => reportTemplatesApi.findAll({ size: 200 }).then((r) => r.data.content),
    staleTime: 5 * 60_000,
  });
  const templateOptions = (templatesData ?? []).map((t) => ({
    value: t.id,
    label: t.title ?? t.name ?? "—",
  }));

  // --- Formulaire
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
  } = useForm<ReportEditFormValues>({
    resolver: zodResolver(reportEditSchema),
    defaultValues: {
      titleId: "",
      content: "",
      contentMicro: "",
      descriptionSupplementaire: "",
      descriptionSupplementaireMicro: "",
      comment: "",
      commentSup: "",
      receiverName: "",
      signatory1Id: "",
      signatory2Id: "",
      signatory3Id: "",
      reviewedById: "",
      tagIds: [],
    },
  });

  // Préremplir le formulaire quand le rapport est chargé
  useEffect(() => {
    if (report) {
      reset({
        titleId: report.titleId ?? "",
        content: report.content ?? "",
        contentMicro: report.contentMicro ?? "",
        descriptionSupplementaire: report.descriptionSupplementaire ?? "",
        descriptionSupplementaireMicro: report.descriptionSupplementaireMicro ?? "",
        comment: report.comment ?? "",
        commentSup: report.commentSup ?? "",
        receiverName: report.receiverName ?? "",
        signatory1Id: report.signatory1Id ?? "",
        signatory2Id: report.signatory2Id ?? "",
        signatory3Id: report.signatory3Id ?? "",
        reviewedById: report.reviewedById ?? "",
        tagIds: report.tagIds ?? [],
      });
    }
  }, [report, reset]);

  // Dérive les états locaux (select d'état + bloc complémentaire) à partir du
  // rapport chargé, pendant le rendu plutôt que dans l'effet ci-dessus (évite un
  // rendu en cascade). Se déclenche à chaque changement de référence de `report`,
  // comme le faisait l'effet. https://react.dev/learn/you-might-not-need-an-effect
  const [prevReport, setPrevReport] = useState<ReportDetail | undefined>(undefined);
  if (report && report !== prevReport) {
    setPrevReport(report);
    setStatusValue(report.status === "DRAFT" ? "0" : "1");
    setShowComplementaire(
      !!report.descriptionSupplementaire || !!report.descriptionSupplementaireMicro
    );
  }

  // Titre par défaut : pour un compte rendu NON validé (DRAFT) qui n'a pas encore
  // de titre, on pré-sélectionne le titre marqué « par défaut ». L'utilisateur reste
  // libre d'en choisir un autre dans la liste. Appliqué une seule fois.
  const defaultTitleApplied = useRef(false);
  useEffect(() => {
    if (!report || defaultTitleApplied.current) return;
    if (report.status === "DRAFT" && !report.titleId && titlesData) {
      const def = titlesData.find((t) => t.isDefault);
      if (def) {
        setValue("titleId", def.id);
        defaultTitleApplied.current = true;
      }
    }
  }, [report, titlesData, setValue]);

  // --- Mutations

  // Réplique du ReportController@store Laravel : UN SEUL enregistrement pilote
  // le contenu ET le statut. Le select « État du compte rendu » décide :
  //   "1" (Terminé)             → status VALIDATED
  //   "0" (En attente relecture) → status DRAFT
  const updateMutation = useMutation({
    mutationFn: (data: ReportEditFormValues) =>
      reportsApi.update(id, {
        titleId: data.titleId || undefined,
        content: data.content || undefined,
        contentMicro: data.contentMicro || undefined,
        descriptionSupplementaire: data.descriptionSupplementaire || undefined,
        descriptionSupplementaireMicro: data.descriptionSupplementaireMicro || undefined,
        comment: data.comment || undefined,
        commentSup: data.commentSup || undefined,
        receiverName: data.receiverName || undefined,
        signatory1Id: data.signatory1Id || undefined,
        signatory2Id: data.signatory2Id || undefined,
        signatory3Id: data.signatory3Id || undefined,
        reviewedById: data.reviewedById || undefined,
        status: statusValue === "1" ? "VALIDATED" : "DRAFT",
        tagIds: data.tagIds ?? [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      toast.success(
        statusValue === "1" ? "Compte rendu validé" : "Compte rendu mis à jour"
      );
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la sauvegarde");
    },
  });

  // Applique le contenu d'un template dans le champ ciblé (« modèle d'expression »)
  const applyTemplate = async (
    templateId: string,
    field: "content" | "contentMicro" | "descriptionSupplementaire" | "descriptionSupplementaireMicro"
  ) => {
    if (!templateId) return;
    try {
      const tpl = await reportTemplatesApi.findById(templateId).then((r) => r.data);
      setValue(field, tpl.content ?? "", { shouldDirty: true });
      toast.success("Template appliqué");
    } catch {
      toast.error("Erreur lors du chargement du template");
    }
  };

  // Ouvre le PDF du compte rendu (Imprimer le compte rendu) dans un nouvel onglet
  const printReport = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      const res = await reportsApi.downloadPdf(id);
      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (tab) tab.close();
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  // ---------------------------------------------------------------------------
  // Guard permission / états de chargement
  // ---------------------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_REPORTS)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Compte rendu introuvable.</p>
      </div>
    );
  }

  // Comme Laravel : le formulaire reste modifiable tant que le compte rendu n'est
  // pas livré (un CR VALIDATED peut être ré-édité / repassé En attente via le
  // select). Seul DELIVERED verrouille l'édition.
  const canEdit = can(PERMISSIONS.EDIT_REPORTS) && report.status !== "DELIVERED";
  const patient = patientProfile?.patient;

  // ---------------------------------------------------------------------------
  // Render — layout Laravel (col-9 principal / col-3 sidebar) puis historiques
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* En-tête : titre + retour à la liste (réplique page-title-box Laravel) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={`Compte rendu : ${report.testOrderCode ?? report.code ?? id}`}
          breadcrumbs={[
            { label: "Accueil", href: "/home" },
            { label: "Comptes rendus", href: "/reports" },
            { label: report.testOrderCode ?? report.code ?? id },
          ]}
        />
        <button
          type="button"
          onClick={() => router.push("/reports")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste des comptes rendus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ============================ COLONNE PRINCIPALE ============================ */}
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <div className="text-right text-xs text-gray-500">
            <span className="text-red-500">*</span> champs obligatoires
          </div>

          {/* --- Titre --- */}
          <Card>
            <label className={labelClass}>
              Titre <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <Controller
                name="titleId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="report-title"
                    options={titleOptions}
                    value={titleOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isDisabled={!canEdit}
                    placeholder="Sélectionner un titre..."
                    noOptionsMessage={() => "Aucun titre"}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>
          </Card>

          {/* --- Contenu de base --- */}
          <Card title="Contenu de base">
            {/* Macro */}
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Macro</h3>

            <div className="mb-3">
              <label className={labelClass}>Template</label>
              <div className="mt-1">
                <Select
                  instanceId="template-macro"
                  options={templateOptions}
                  value={null}
                  onChange={(opt) => opt?.value && applyTemplate(opt.value, "content")}
                  isDisabled={!canEdit}
                  placeholder="Sélectionner un template"
                  noOptionsMessage={() => "Aucun template"}
                  classNamePrefix="react-select"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className={labelClass}>Commentaire</label>
              <textarea
                {...register("comment")}
                rows={4}
                disabled={!canEdit}
                placeholder="Commentaire..."
                className={`mt-1 ${textareaClass}`}
              />
            </div>

            <div className="mb-6">
              <label className={labelClass}>
                Récapitulatifs <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={!canEdit}
                      placeholder="Saisir le récapitulatif macroscopique..."
                      minHeightClass="min-h-[300px]"
                    />
                  )}
                />
              </div>
            </div>

            {/* Micro */}
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Micro</h3>

            <div className="mb-3">
              <label className={labelClass}>Template</label>
              <div className="mt-1">
                <Select
                  instanceId="template-micro"
                  options={templateOptions}
                  value={null}
                  onChange={(opt) => opt?.value && applyTemplate(opt.value, "contentMicro")}
                  isDisabled={!canEdit}
                  placeholder="Sélectionner un template"
                  noOptionsMessage={() => "Aucun template"}
                  classNamePrefix="react-select"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Récapitulatifs <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <Controller
                  name="contentMicro"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={!canEdit}
                      placeholder="Saisir le récapitulatif microscopique..."
                      minHeightClass="min-h-[300px]"
                    />
                  )}
                />
              </div>
            </div>
          </Card>

          {/* --- Contenu complémentaire (affiché via le switch de la sidebar) --- */}
          {showComplementaire && (
            <Card title="Contenu complémentaire">
              <div className="mb-3">
                <label className={labelClass}>Template</label>
                <div className="mt-1">
                  <Select
                    instanceId="template-sup"
                    options={templateOptions}
                    value={null}
                    onChange={(opt) => opt?.value && applyTemplate(opt.value, "descriptionSupplementaire")}
                    isDisabled={!canEdit}
                    placeholder="Sélectionner un template"
                    noOptionsMessage={() => "Aucun template"}
                    classNamePrefix="react-select"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className={labelClass}>Commentaire supplémentaire</label>
                <textarea
                  {...register("commentSup")}
                  rows={4}
                  disabled={!canEdit}
                  placeholder="Commentaire supplémentaire..."
                  className={`mt-1 ${textareaClass}`}
                />
              </div>

              <div className="mb-6">
                <label className={labelClass}>
                  Récapitulatifs <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <Controller
                    name="descriptionSupplementaire"
                    control={control}
                    render={({ field }) => (
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canEdit}
                        placeholder="Récapitulatif complémentaire..."
                        minHeightClass="min-h-[200px]"
                      />
                    )}
                  />
                </div>
              </div>

              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Micro</h3>
              <div className="mb-3">
                <label className={labelClass}>Template</label>
                <div className="mt-1">
                  <Select
                    instanceId="template-sup-micro"
                    options={templateOptions}
                    value={null}
                    onChange={(opt) => opt?.value && applyTemplate(opt.value, "descriptionSupplementaireMicro")}
                    isDisabled={!canEdit}
                    placeholder="Sélectionner un template"
                    noOptionsMessage={() => "Aucun template"}
                    classNamePrefix="react-select"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Récapitulatifs <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <Controller
                    name="descriptionSupplementaireMicro"
                    control={control}
                    render={({ field }) => (
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canEdit}
                        placeholder="Récapitulatif microscopique complémentaire..."
                        minHeightClass="min-h-[200px]"
                      />
                    )}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* --- Pièces jointes ---
              Section en lecture seule, comme `reports/show.blade.php` : les
              images affichées ici sont celles de la galerie du bon d'examen.
              Elles s'ajoutent depuis la page « détails » du bon, jamais depuis
              le compte rendu — d'où le lien explicite ci-dessous. */}
          <Card title="Pièces jointes">
            {(galleryImages?.length ?? 0) === 0 ? (
              <p className="flex items-center gap-2 text-sm italic text-gray-400">
                <Paperclip className="h-4 w-4" />
                Aucune pièce jointe.
              </p>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {(galleryImages ?? []).map((img) => (
                  <AuthThumbnail
                    key={img.index}
                    filename={img.filename}
                    alt={`Image ${img.index + 1}`}
                    onClick={() => openDocFile(img.filename)}
                  />
                ))}
              </div>
            )}
            {report?.testOrderId && (
              <p className="mt-3 text-xs text-gray-500">
                Les pièces jointes proviennent de la galerie du bon d&apos;examen.{" "}
                <Link
                  href={`/test-orders/${report.testOrderId}/details`}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ajouter ou retirer une image (nouvel onglet)"
                >
                  Ajouter ou retirer une image
                  <SquareArrowOutUpRight aria-hidden="true" className="h-3 w-3 opacity-70" />
                </Link>
              </p>
            )}
          </Card>

          {/* --- Signature --- */}
          <Card title={<span>Signature <span className="text-red-500">*</span></span>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Signé par</label>
                <div className="mt-1">
                  <Controller
                    name="signatory1Id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        instanceId="report-signatory1"
                        options={userOptions}
                        value={userOptions.find((o) => o.value === field.value) ?? null}
                        onChange={(opt) => field.onChange(opt?.value ?? "")}
                        isDisabled={!canEdit}
                        isClearable
                        placeholder="Sélectionner un docteur"
                        noOptionsMessage={() => "Aucun utilisateur"}
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Second avis de relecture donné et validé par :
                </label>
                <div className="mt-1">
                  <Controller
                    name="reviewedById"
                    control={control}
                    render={({ field }) => (
                      <Select
                        instanceId="report-reviewer"
                        options={userOptions}
                        value={userOptions.find((o) => o.value === field.value) ?? null}
                        onChange={(opt) => field.onChange(opt?.value ?? "")}
                        isDisabled={!canEdit}
                        isClearable
                        placeholder="Sélectionner un docteur"
                        noOptionsMessage={() => "Aucun utilisateur"}
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>
                Etat du compte rendu <span className="text-red-500">*</span>
              </label>
              <NativeSelect
                className="mt-1"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value as "0" | "1")}
                disabled={!canEdit}
              >
                <option value="0">En attente de relecture</option>
                <option value="1">Terminé</option>
              </NativeSelect>
            </div>

            {/* Mettre à jour (Laravel : bouton unique qui enregistre + applique le statut) */}
            <PermissionGate permission={PERMISSIONS.EDIT_REPORTS}>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSubmit((data) => updateMutation.mutate(data))}
                  disabled={updateMutation.isPending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {updateMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                </button>
              )}
            </PermissionGate>
          </Card>
        </div>

        {/* ============================ SIDEBAR ============================ */}
        <div className="space-y-4 lg:col-span-4 xl:col-span-3">
          {/* État du compte rendu */}
          <Card title="État du compte rendu">
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-center gap-2">
                <span className="font-semibold">État :</span>
                <StatusBadge status={report.status} domain="report" />
              </p>
              <p>
                <span className="font-semibold">Créé le :</span>{" "}
                {formatDate(report.createdAt)}
              </p>
              <p>
                <span className="font-semibold">Dernière mise à jour :</span>{" "}
                {formatDate(report.updatedAt)}
              </p>

              {/* Switch Complémentaire */}
              <div className="pt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showComplementaire}
                    onChange={(e) => setShowComplementaire(e.target.checked)}
                    disabled={!canEdit}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">Complémentaire</span>
                </label>
              </div>

              {/* Tags */}
              <div className="pt-2">
                <label className={labelClass}>
                  Tags <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <Controller
                    name="tagIds"
                    control={control}
                    render={({ field }) => (
                      <Select
                        instanceId="report-tags"
                        isMulti
                        options={tagOptions}
                        value={tagOptions.filter((o) => (field.value ?? []).includes(o.value))}
                        onChange={(opts) => field.onChange(opts.map((o) => o.value))}
                        isDisabled={!canEdit}
                        placeholder="Sélectionner les tags"
                        noOptionsMessage={() => "Aucun tag"}
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Informations patient */}
          <Card title="Informations patient">
            <div className="space-y-1.5 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Nom :</span>{" "}
                {patient
                  ? `${patient.lastname} ${patient.firstname}`.trim()
                  : report.patientName ?? "—"}
              </p>
              <p>
                <span className="font-semibold">Code patient :</span>{" "}
                {patient?.code ?? "—"}
              </p>
              <p>
                <span className="font-semibold">Téléphone :</span>{" "}
                {patient?.telephone1 ?? "—"}
              </p>
            </div>
          </Card>

          {/* Signataires */}
          <Card title="Signataires">
            <div className="space-y-1.5 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Signature 1 :</span>{" "}
                {report.signatory1Name ?? "Inactif"}
              </p>
              <p>
                <span className="font-semibold">Avis de relecture :</span>{" "}
                {report.reviewedByName ?? "Inactif"}
              </p>
            </div>
          </Card>

          {/* Code ANAPATH */}
          {report.testOrderCode && (
            <Card title="Code ANAPATH">
              <div className="flex flex-col items-center">
                <QRCodeSVG value={report.testOrderCode} size={140} level="M" />
              </div>
            </Card>
          )}

          {/* Imprimer le compte rendu */}
          <Button
            onClick={printReport}
            icon={<Printer className="h-4 w-4" />}
            className="w-full rounded-lg bg-gray-600 px-4 py-2.5 text-sm font-medium hover:bg-gray-700 hover:shadow-none"
          >
            Imprimer le compte rendu
          </Button>
        </div>
      </div>

      {/* ============================ HISTORIQUES (pleine largeur) ============================ */}
      <Card title="Historiques">
        {(report.logs?.length ?? 0) === 0 ? (
          <p className="text-sm italic text-gray-400">Aucune activité enregistrée.</p>
        ) : (
          <div>
            <TableLengthControl pagination={logsPagination} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Opération</th>
                    <th className="px-3 py-2 font-medium">Utilisateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsPagination.pageRows.map((log, idx) => (
                    <tr key={logsPagination.offset + idx} className="text-gray-700">
                      <td className="px-3 py-2">{logsPagination.offset + idx + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-3 py-2">{log.action}</td>
                      <td className="px-3 py-2">{log.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePaginationFooter pagination={logsPagination} />
          </div>
        )}
      </Card>
    </div>
  );
}
