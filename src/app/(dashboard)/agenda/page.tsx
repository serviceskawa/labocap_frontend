"use client";

/**
 * Agenda — rendez-vous de la branche active (module optionnel `agenda`,
 * cf. docs/modules.md : la route est gardée par le proxy).
 *
 * Reprise fonctionnelle de l'agenda LabPro (FullCalendar) : clic sur une case
 * pour créer, clic sur un rendez-vous pour l'ouvrir, glisser-déposer pour le
 * déplacer — ce dernier réservé à `edit-appointments`.
 */

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PermissionGate } from "@/components/common/PermissionGate";
import { AlertBox } from "@/components/ui/AlertBox";
import {
  AppointmentModal,
  type AppointmentModalMode,
} from "@/components/agenda/AppointmentModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { appointmentsApi, toLocalIso } from "@/lib/api/appointments";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import type { ApiError } from "@/types/api";

// FullCalendar mesure le DOM et injecte sa feuille de style à l'import :
// aucun intérêt à le rendre côté serveur.
const AgendaCalendar = dynamic(
  () => import("@/components/agenda/AgendaCalendar"),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-gray-500">
        Chargement du calendrier…
      </p>
    ),
  },
);

const CALENDAR_KEY = ["appointments", "calendar"] as const;

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [modal, setModal] = useState<AppointmentModalMode | null>(null);

  const canCreate = can(PERMISSIONS.CREATE_APPOINTMENTS);
  const canEdit = can(PERMISSIONS.EDIT_APPOINTMENTS);

  const { data: events = [], isError, error } = useQuery({
    queryKey: CALENDAR_KEY,
    queryFn: () => appointmentsApi.calendar().then((r) => r.data),
  });

  // Déplacement par glisser-déposer : le PUT exige la requête complète, que le
  // flux du calendrier ne porte pas (ni patient, ni message) — on relit donc
  // la fiche avant de ne changer que l'heure.
  const moveMutation = useMutation({
    mutationFn: async ({ id, start }: { id: string; start: Date }) => {
      const { data: a } = await appointmentsApi.findById(id);
      return appointmentsApi.update(id, {
        patientId: a.patientId,
        doctorId: a.doctorId ?? undefined,
        time: toLocalIso(start),
        priority: a.priority ?? undefined,
        message: a.message ?? undefined,
      });
    },
    onSuccess: () => toast.success("Rendez-vous déplacé"),
    onError: (err: AxiosError<ApiError>) =>
      toast.error(
        getApiErrorMessage(err, "Impossible de déplacer le rendez-vous"),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const handleMove = useCallback(
    async (id: string, start: Date) => {
      await moveMutation.mutateAsync({ id, start });
    },
    [moveMutation],
  );

  const handleCreateAt = useCallback(
    (date: Date) => setModal({ kind: "create", date }),
    [],
  );
  const handleOpen = useCallback(
    (id: string) => setModal({ kind: "edit", id }),
    [],
  );

  return (
    <>
      <PageHeader
        title="Agenda"
        breadcrumbs={[{ label: "Accueil", href: "/home" }, { label: "Agenda" }]}
        action={
          <PermissionGate permission={PERMISSIONS.CREATE_APPOINTMENTS}>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setModal({ kind: "create" })}
            >
              Ajouter
            </Button>
          </PermissionGate>
        }
      />

      {isError && (
        <AlertBox
          type="error"
          message={getApiErrorMessage(
            error as AxiosError<ApiError>,
            "Impossible de charger l'agenda",
          )}
        />
      )}

      <div className="hyper-card">
        <div className="hyper-card-body">
          <AgendaCalendar
            events={events}
            onOpen={handleOpen}
            onCreateAt={canCreate ? handleCreateAt : undefined}
            onMove={canEdit ? handleMove : undefined}
          />
        </div>
      </div>

      {modal && (
        <AppointmentModal
          key={modal.kind === "edit" ? modal.id : "create"}
          mode={modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
