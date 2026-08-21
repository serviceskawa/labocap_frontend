import { MAX_VISIBLE_OPTIONS } from "@/components/ui/LimitedSelect";
import type { SelectOption } from "@/components/ui/FormSelect";
import { patientsApi, type Patient } from "./patients";
import { doctorsApi, type Doctor } from "./doctors";
import { hospitalsApi, type Hospital } from "./hospitals";
import { testOrdersApi, type TestOrder } from "./testOrders";
import { nomComplet } from "@/lib/utils";

/**
 * Chargeurs d'options pour `RemoteSelectField` : la recherche est envoyée à
 * l'API, elle porte donc sur **toute la base** et pas sur une page préchargée.
 * On ne demande que 6 éléments — c'est tout ce que le menu affiche.
 *
 * Les fonctions `*ToOption` servent à afficher une valeur déjà sélectionnée
 * (page d'édition, entité tout juste créée) sans avoir à la rechercher.
 */

const SIZE = MAX_VISIBLE_OPTIONS;

/**
 * La base (migrée de Laravel) contient des médecins et des hôpitaux en double
 * (même nom, ids différents) : on ne garde que la première occurrence de chaque
 * libellé, comme le faisaient les listes préchargées.
 */
function dedupeByLabel(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = o.label.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Patients (13 000+) -----------------------------------------------------

export function patientToOption(p: Patient): SelectOption {
  return {
    value: p.id,
    label: `${p.code} - ${nomComplet(p.lastname, p.firstname)}`,
  };
}

/** Recherche serveur sur prénom, nom, téléphone et code patient. */
export const loadPatientOptions = (input: string): Promise<SelectOption[]> =>
  patientsApi
    .findAll({ size: SIZE, search: input || undefined })
    .then((r) => r.data.content.map(patientToOption));

// --- Médecins (1 000+) ------------------------------------------------------

export function doctorToOption(d: Doctor): SelectOption {
  return { value: d.id, label: d.name };
}

/** `/doctors/search` cherche par nom sur toute la base ; sans saisie, on prend les premiers. */
export const loadDoctorOptions = (input: string): Promise<SelectOption[]> =>
  (input
    ? doctorsApi.search(input).then((r) => r.data)
    : doctorsApi.findAll({ size: SIZE * 4 }).then((r) => r.data.content)
  ).then((list) => dedupeByLabel(list.map(doctorToOption)));

// --- Hôpitaux ---------------------------------------------------------------

export function hospitalToOption(h: Hospital): SelectOption {
  return { value: h.id, label: h.name };
}

export const loadHospitalOptions = (input: string): Promise<SelectOption[]> =>
  (input
    ? hospitalsApi.search(input).then((r) => r.data)
    : hospitalsApi.findAll({ size: SIZE * 4 }).then((r) => r.data.content)
  ).then((list) => dedupeByLabel(list.map(hospitalToOption)));

// --- Demandes d'examen (14 000+) --------------------------------------------

/** Option d'une demande d'examen : porte la demande complète (`order`). */
export interface TestOrderOption extends SelectOption {
  order: TestOrder;
}

export function testOrderToOption(o: TestOrder): TestOrderOption {
  const patient = `${o.patientFirstname ?? ""} ${o.patientLastname ?? ""}`.trim();
  // Quelques demandes migrées n'ont pas de code : ne pas afficher « null — … ».
  return {
    value: o.id,
    label: o.code ? `${o.code} — ${patient}` : patient,
    order: o,
  };
}

/**
 * Recherche serveur des demandes d'examen. `filters` permet de restreindre
 * (statut, patient…) : la recherche reste faite sur toute la base, dans les
 * limites de ce filtre. `size` y est surchargeable quand l'appelant écarte
 * ensuite des résultats (ex. demandes déjà affectées) et veut garder 6 lignes.
 */
export const loadTestOrderOptions =
  (filters: { status?: string; patientId?: string; size?: number } = {}) =>
  (input: string): Promise<TestOrderOption[]> =>
    testOrdersApi
      .findAll({ size: SIZE, search: input || undefined, ...filters })
      .then((r) => r.data.content.map(testOrderToOption));

