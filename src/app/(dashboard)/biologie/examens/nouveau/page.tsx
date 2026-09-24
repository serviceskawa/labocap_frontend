"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { AlertBox } from "@/components/ui/AlertBox";
import {
  BiologyLabTestForm,
  toBiologyLabTestRequest,
} from "@/components/biology/BiologyLabTestForm";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { labTestsApi } from "@/lib/api/examens";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

/**
 * Création d'une analyse de biologie. La fiche de paramètres (PANEL) ou les
 * options de culture (CULTURE) se renseignent ensuite sur la page de
 * l'analyse, vers laquelle on redirige : elles exigent son identifiant.
 */
export default function NouvelExamenBiologiePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canAll } = usePermissions();
  const canCreate = canAll(PERMISSIONS.CREATE_TESTS, PERMISSIONS.EDIT_TESTS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvel examen de biologie"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Examens de biologie", href: "/biologie/examens" },
          { label: "Nouveau" },
        ]}
      />

      <AlertBox
        type="info"
        message="Après l'enregistrement, vous pourrez composer la fiche de paramètres ou choisir les options de culture."
      />

      <BiologyLabTestForm
        submitLabel="Créer l'examen"
        readOnly={!canCreate}
        onSubmit={async (values) => {
          try {
            const res = await labTestsApi.create(toBiologyLabTestRequest(values));
            queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
            toast.success("Examen créé avec succès");
            router.replace(`/biologie/examens/${res.data.id}`);
          } catch (err) {
            toast.error(getApiErrorMessage(err as AxiosError<ApiError>, "Erreur lors de la création"));
          }
        }}
      />
    </div>
  );
}
