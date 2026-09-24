import apiClient from "./client";

/**
 * Agenda — rendez-vous de la branche active (module optionnel `agenda`).
 *
 * Dates : le backend manipule des `LocalDateTime` (sans fuseau). Elles
 * transitent donc en ISO local, `yyyy-MM-ddTHH:mm[:ss]`, et c'est aussi ce que
 * FullCalendar interprète en heure locale — aucune conversion UTC ne doit
 * s'intercaler, sous peine de décaler chaque rendez-vous du fuseau du poste.
 */

/** Date locale → ISO sans fuseau `yyyy-MM-ddTHH:mm:ss` (LocalDateTime du backend). */
export function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

/** Priorités acceptées par le backend (colonne `priority`, texte libre). */
export const APPOINTMENT_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "tres urgent", label: "Très urgent" },
] as const;

export type AppointmentPriority =
  (typeof APPOINTMENT_PRIORITIES)[number]["value"];

/** Évènement de `GET /appointments/calendar` — toute la branche, sans borne de dates. */
export interface AppointmentCalendarEvent {
  id: string;
  /** « RDV <médecin> », ou chaîne vide si aucun médecin n'est désigné. */
  title: string;
  start: string;
  doctorId?: string | null;
  doctorName?: string | null;
  /**
   * Classe héritée de Laravel (`randColor()`), dérivée de la priorité :
   * `bg-info` (normal), `bg-warning` (urgent), `bg-danger` (très urgent).
   */
  className?: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientFirstname?: string | null;
  patientLastname?: string | null;
  /** Médecin interne : identifiant d'un **utilisateur** (rôle Docteur), pas d'un prescripteur. */
  doctorId?: string | null;
  doctorFirstname?: string | null;
  doctorLastname?: string | null;
  date: string;
  priority?: string | null;
  status?: string | null;
  message?: string | null;
  branchId: string;
  createdAt: string;
}

export interface AppointmentRequest {
  patientId: string;
  doctorId?: string;
  /** ISO local, `yyyy-MM-ddTHH:mm:ss`. */
  time: string;
  message?: string;
  priority?: string;
}

/** Consultation créée (ou retrouvée) à partir d'un rendez-vous. */
export interface AppointmentConsultation {
  id: string;
  code: string;
  patientId: string;
  status?: string | null;
  date?: string | null;
}

export const appointmentsApi = {
  calendar: () =>
    apiClient.get<AppointmentCalendarEvent[]>("/appointments/calendar"),
  findById: (id: string) => apiClient.get<Appointment>(`/appointments/${id}`),
  create: (data: AppointmentRequest) =>
    apiClient.post<Appointment>("/appointments", data),
  update: (id: string, data: AppointmentRequest) =>
    apiClient.put<Appointment>(`/appointments/${id}`, data),
  remove: (id: string) => apiClient.delete(`/appointments/${id}`),
  /**
   * Idempotent côté serveur : renvoie la consultation existante (200) si le
   * rendez-vous en a déjà une, sinon la crée (201). Exige `create-consultations`.
   */
  startConsultation: (id: string) =>
    apiClient.post<AppointmentConsultation>(
      `/appointments/${id}/consultation`,
    ),
};
