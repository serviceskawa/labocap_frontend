"use client";

import { use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BiologyKindBadge } from "@/components/biology/BiologyKindBadge";
import {
  BiologyLabTestForm,
  toBiologyLabTestRequest,
} from "@/components/biology/BiologyLabTestForm";
import { ParameterSheetEditor } from "@/components/biology/ParameterSheetEditor";
import { CultureOptionsPicker } from "@/components/biology/CultureOptionsPicker";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { labTestsApi } from "@/lib/api/examens";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Analyse de biologie : informations générales, puis selon sa nature la
 * fiche de paramètres (PANEL) ou les options de culture (CULTURE).
 */
export default function ExamenBiologiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data: labTest, isLoading, isError } = useQuery({
    queryKey: ["lab-tests", "detail", id],
    queryFn: () => labTestsApi.getById(id).then((r) => r.data),
  });

  const breadcrumbs = [
    { label: "Accueil", href: "/home" },
    { label: "Examens de biologie", href: "/biologie/examens" },
    { label: labTest?.name ?? "Examen" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Examen de biologie" breadcrumbs={breadcrumbs} />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !labTest || labTest.discipline !== "BIOLOGY") {
    return (
      <div className="space-y-6">
        <PageHeader title="Examen de biologie" breadcrumbs={breadcrumbs} />
        <EmptyState
          title="Examen introuvable"
          description="Cet examen n'existe pas ou n'est pas un examen de biologie."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={labTest.name}
        subtitle={labTest.categoryTestName ?? undefined}
        breadcrumbs={breadcrumbs}
        action={<BiologyKindBadge kind={labTest.biologyKind} />}
      />

      <BiologyLabTestForm
        labTest={labTest}
        submitLabel="Enregistrer"
        readOnly={!can(PERMISSIONS.EDIT_TESTS)}
        onSubmit={async (values) => {
          try {
            const res = await labTestsApi.update(id, toBiologyLabTestRequest(values));
            queryClient.setQueryData(["lab-tests", "detail", id], res.data);
            queryClient.invalidateQueries({ queryKey: ["lab-tests"], exact: false });
            toast.success("Examen modifié avec succès");
          } catch (err) {
            toast.error(getApiErrorMessage(err as AxiosError<ApiError>, "Erreur lors de la modification"));
          }
        }}
      />

      {labTest.biologyKind === "CULTURE" ? (
        <CultureOptionsPicker
          labTestId={id}
          readOnly={!can(PERMISSIONS.MANAGE_CULTURE_OPTIONS)}
        />
      ) : (
        <ParameterSheetEditor
          labTestId={id}
          readOnly={!can(PERMISSIONS.MANAGE_BIOLOGY_PARAMETERS)}
        />
      )}
    </div>
  );
}
