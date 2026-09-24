"use client";

/**
 * Création / édition d'un rendez-vous de l'agenda.
 *
 * Fonctionnellement repris de l'agenda LabPro (NewEventModal / EditEventModal),
 * adapté au contrat du backend : patient obligatoire, médecin interne
 * facultatif (un **utilisateur** au rôle Docteur, pas un prescripteur), date et
 * heure, priorité, message. Le statut n'est pas modifiable ici — le backend
 * l'initialise à `pending` et ne l'expose pas dans la requête.
 *
 * En édition, la modale porte aussi la suppression (ConfirmModal) et le
 * démarrage de la consultation, chacun sous sa propre permission.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Stethoscope, Trash2 } from "lucide-react";
import type { AxiosError } from "axios";

import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import type { SelectOption } from "@/components/ui/FormSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import { loadPatientOptions } from "@/lib/api/optionLoaders";
import { usersApi } from "@/lib/api/users";
import {
  APPOINTMENT_PRIORITIES,
  appointmentsApi,
  toLocalIso,
  type AppointmentRequest,
} from "@/lib/api/appointments";
import { getApiErrorMessage } from "@/lib/api/errorMessages";
import { nomComplet } from "@/lib/utils";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Le patient est requis"),
  doctorId: z.string().optional(),
  time: z.string().min(1, "La date et l'heure sont requises"),
  priority: z.string().min(1, "La priorité est requise"),
  message: z
    .string()
    .max(2000, "Le message ne doit pas dépasser 2000 caractères")
    .optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

// ---------------------------------------------------------------------------
// Utilitaires de date (heure locale, sans fuseau — LocalDateTime du backend)
// ---------------------------------------------------------------------------

/** Date → valeur d'un `<input type="datetime-local">` (`yyyy-MM-ddTHH:mm`). */
function toInputValue(date: Date): string {
  return toLocalIso(date).slice(0, 16);
}

/** ISO local renvoyé par l'API → valeur de champ (on tronque les secondes). */
function isoToInputValue(iso: string): string {
  return iso.slice(0, 16);
}

/** Valeur de champ → ISO local attendu par l'API. */
function inputValueToIso(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

// ---------------------------------------------------------------------------
// Médecins internes
// ---------------------------------------------------------------------------

/**
 * Les médecins d'un rendez-vous sont des utilisateurs au rôle Docteur —
 * exactement la liste `/users/signataires`. Elle est courte : on la charge une
 * fois (même clé que l'écran de compte rendu, donc cache partagé) et on la
 * filtre localement. Un 403 (profil sans `edit-reports` ni droit
 * d'affectation) laisse simplement la liste vide : le médecin est facultatif.
 */
function useDoctorLoader() {
  const queryClient = useQueryClient();
  return useCallback(
    async (input: string): Promise<SelectOption[]> => {
      try {
        const list = await queryClient.fetchQuery({
          queryKey: ["signataires"],
          queryFn: () => usersApi.findSignataires().then((r) => r.data),
          staleTime: 5 * 60 * 1000,
          retry: false,
        });
        const term = input.trim().toLowerCase();
        return list
          .filter((d) => d.actif !== false)
          .filter((d) => !term || d.nom.toLowerCase().includes(term))
          .map((d) => ({ value: d.id, label: d.nom }));
      } catch {
        return [];
      }
    },
    [queryClient],
  );
}

// ---------------------------------------------------------------------------
// Modale
// ---------------------------------------------------------------------------

export type AppointmentModalMode =
  | { kind: "create"; date?: Date }
  | { kind: "edit"; id: string };

interface AppointmentModalProps {
  mode: AppointmentModalMode;
  onClose: () => void;
}

const DEFAULT_VALUES: AppointmentFormData = {
  patientId: "",
  doctorId: "",
  time: "",
  priority: "normal",
  message: "",
};

export function AppointmentModal({ mode, onClose }: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();
  const loadDoctorOptions = useDoctorLoader();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = mode.kind === "edit";
  const editId = isEdit ? mode.id : null;
  const readOnly = isEdit && !can(PERMISSIONS.EDIT_APPOINTMENTS);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointments", "detail", editId],
    queryFn: () => appointmentsApi.findById(editId!).then((r) => r.data),
    enabled: !!editId,
  });

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      time:
        mode.kind === "create" && mode.date ? toInputValue(mode.date) : "",
    },
  });
  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = form;

  // Édition : le formulaire se remplit dès que la fiche est chargée.
  useEffect(() => {
    if (!appointment) return;
    reset({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId ?? "",
      time: isoToInputValue(appointment.date),
      priority: appointment.priority || "normal",
      message: appointment.message ?? "",
    });
  }, [appointment, reset]);

  // Libellés des valeurs déjà posées : les listes ne sont pas préchargées.
  const initialPatientOption = useMemo<SelectOption | null>(
    () =>
      appointment
        ? {
            value: appointment.patientId,
            label: nomComplet(
              appointment.patientLastname,
              appointment.patientFirstname,
            ),
          }
        : null,
    [appointment],
  );
  const initialDoctorOption = useMemo<SelectOption | null>(
    () =>
      appointment?.doctorId
        ? {
            value: appointment.doctorId,
            label: nomComplet(
              appointment.doctorLastname,
              appointment.doctorFirstname,
            ),
          }
        : null,
    [appointment],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments"] });

  const saveMutation = useMutation({
    mutationFn: (payload: AppointmentRequest) =>
      editId
        ? appointmentsApi.update(editId, payload)
        : appointmentsApi.create(payload),
    onSuccess: () => {
      toast.success(
        editId ? "Rendez-vous mis à jour" : "Rendez-vous ajouté à l'agenda",
      );
      invalidate();
      onClose();
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(
        getApiErrorMessage(err, "Erreur lors de l'enregistrement du rendez-vous"),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.remove(id),
    onSuccess: () => {
      toast.success("Rendez-vous supprimé");
      invalidate();
      setConfirmDelete(false);
      onClose();
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(
        getApiErrorMessage(err, "Erreur lors de la suppression du rendez-vous"),
      ),
  });

  const consultationMutation = useMutation({
    mutationFn: (id: string) =>
      appointmentsApi.startConsultation(id).then((r) => r.data),
    onSuccess: (consultation) => {
      toast.success(
        consultation.code
          ? `Consultation ${consultation.code} ouverte`
          : "Consultation ouverte",
      );
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      invalidate();
      onClose();
      // L'application n'a pas (encore) de fiche consultation par identifiant :
      // on mène à la liste, où la consultation créée apparaît en tête.
      if (can(PERMISSIONS.VIEW_CONSULTATIONS)) router.push("/consultations");
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(
        getApiErrorMessage(err, "Impossible de démarrer la consultation"),
      ),
  });

  const onValid = async (values: AppointmentFormData) => {
    await saveMutation
      .mutateAsync({
        patientId: values.patientId,
        doctorId: values.doctorId || undefined,
        time: inputValueToIso(values.time),
        priority: values.priority,
        message: values.message?.trim() || undefined,
      })
      .catch(() => undefined); // l'erreur est déjà signalée par onError
  };

  const title = isEdit
    ? readOnly
      ? "Rendez-vous"
      : "Modifier le rendez-vous"
    : "Nouveau rendez-vous";

  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {isEdit && appointment && (
          <>
            <PermissionGate permission={PERMISSIONS.DELETE_APPOINTMENTS}>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setConfirmDelete(true)}
              >
                Supprimer
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.CREATE_CONSULTATIONS}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Stethoscope className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await consultationMutation
                    .mutateAsync(appointment.id)
                    .catch(() => undefined);
                }}
              >
                Démarrer la consultation
              </Button>
            </PermissionGate>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {readOnly ? "Fermer" : "Annuler"}
        </Button>
        {!readOnly && (
          <Button
            disabled={isEdit && !appointment}
            onClick={handleSubmit(onValid)}
          >
            Enregistrer
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <CrudModal
        isOpen
        onClose={onClose}
        title={title}
        size="lg"
        footer={footer}
      >
        {isEdit && isLoading ? (
          <p className="py-6 text-center text-gray-500">Chargement…</p>
        ) : (
          <form
            noValidate
            onSubmit={(e) => e.preventDefault()}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <FormField
              label="Patient"
              required
              error={errors.patientId?.message}
              className="sm:col-span-2"
            >
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <RemoteSelectField
                    id="appointment-patient"
                    loadOptions={loadPatientOptions}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    selectedOption={initialPatientOption}
                    placeholder="Rechercher un patient (nom, code, téléphone)..."
                    isDisabled={readOnly}
                    menuPortal
                  />
                )}
              />
            </FormField>

            <FormField label="Médecin" className="sm:col-span-2">
              <Controller
                name="doctorId"
                control={control}
                render={({ field }) => (
                  <RemoteSelectField
                    id="appointment-doctor"
                    loadOptions={loadDoctorOptions}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    selectedOption={initialDoctorOption}
                    placeholder="Rechercher un médecin..."
                    isDisabled={readOnly}
                    menuPortal
                  />
                )}
              />
            </FormField>

            <FormField
              label="Date et heure"
              required
              error={errors.time?.message}
            >
              <TextInput
                type="datetime-local"
                {...register("time")}
                error={!!errors.time}
                disabled={readOnly}
              />
            </FormField>

            <FormField
              label="Priorité"
              required
              error={errors.priority?.message}
            >
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    id="appointment-priority"
                    name={field.name}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!errors.priority}
                    disabled={readOnly}
                  >
                    {APPOINTMENT_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              />
            </FormField>

            <FormField
              label="Message"
              error={errors.message?.message}
              className="sm:col-span-2"
            >
              <textarea
                rows={3}
                {...register("message")}
                placeholder="Motif, consignes pour le patient..."
                className={`${inputClass} resize-none`}
                disabled={readOnly}
              />
            </FormField>
          </form>
        )}
      </CrudModal>

      {editId && (
        <ConfirmModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(editId).catch(() => undefined);
          }}
          title="Supprimer le rendez-vous"
          message="Ce rendez-vous sera retiré de l'agenda. Cette action est irréversible."
          confirmLabel="Supprimer"
        />
      )}
    </>
  );
}
