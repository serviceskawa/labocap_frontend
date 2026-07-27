import apiClient from "./client";

/**
 * Accès aux deux tables clé/valeur du backend, comme côté Laravel :
 *
 *  - `setting_apps` (`/setting-apps`) : réglages applicatifs (Général, Email/SMTP,
 *    Communication mobile, en-tête/pied de compte rendu, OurVoice…).
 *  - `settings` (`/settings`) : réglages consommés par le métier — notamment
 *    `token_payment` (MECeF).
 *
 * Les deux exposent un upsert par clé (POST) : créer si la clé n'existe pas,
 * sinon mettre à jour la valeur.
 */

interface BackendKV {
  id: string;
  key: string;
  value: string;
  label?: string;
  placeholder?: string;
  ico?: string;
  branchId?: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

/** Transforme la page renvoyée par le backend en simple map clé → valeur. */
function toMap(list: BackendKV[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of list) map[item.key] = item.value ?? "";
  return map;
}

export const settingAppsApi = {
  getAll: async (): Promise<Record<string, string>> => {
    const res = await apiClient.get<PageResponse<BackendKV>>("/setting-apps", {
      params: { size: 200 },
    });
    return toMap(res.data?.content ?? []);
  },
  upsert: (key: string, value: string) =>
    apiClient.post("/setting-apps", { key, value }),
};

export const settingsStoreApi = {
  getAll: async (): Promise<Record<string, string>> => {
    const res = await apiClient.get<PageResponse<BackendKV>>("/settings", {
      params: { size: 200 },
    });
    return toMap(res.data?.content ?? []);
  },
  upsert: (key: string, value: string) =>
    apiClient.post("/settings", { key, value }),
};

/**
 * Clés stockées dans la table `settings` (et non `setting_apps`) car elles sont
 * lues directement par le métier backend.
 *
 * `prefixe_code_demande_examen` n'en fait volontairement PAS partie : comme dans
 * Laravel (`SettingApp::where('key','prefixe_code_demande_examen')` dans
 * `generateCodeExamen()`), le préfixe des codes de demande d'examen vit dans
 * `setting_apps` — c'est là que le backend Java le lit désormais.
 */
export const SETTINGS_STORE_KEYS = new Set<string>(["token_payment"]);
