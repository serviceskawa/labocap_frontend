import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/**
 * Habillage de l'application (logo, nom du labo, favicon) servi par la route
 * publique `/public/branding` du backend.
 *
 * Volontairement porté par une instance axios **nue** plutôt que par `apiClient` :
 * ce point d'entrée est appelé depuis l'écran de connexion, or l'intercepteur de
 * `apiClient` tente un `POST /auth/refresh` puis redirige vers `/login` sur 401.
 * Un appel non authentifié qui traverserait cette mécanique risquerait une boucle
 * de redirection sur la page de login elle-même. Aucun cookie n'est envoyé
 * (`withCredentials` absent) : la route ne dépend d'aucune session.
 */
export const brandingApi = {
  get: async (): Promise<Record<string, string>> => {
    const res = await axios.get<{ data: Record<string, string> }>(
      `${API_BASE_URL}/public/branding`,
      { headers: { Accept: "application/json" } }
    );
    return res.data?.data ?? {};
  },
};
