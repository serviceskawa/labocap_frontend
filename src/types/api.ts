export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
  /**
   * Détail des erreurs de validation, champ par champ, tel que le renvoie le
   * GlobalExceptionHandler du backend :
   * `{ "message": "Erreurs de validation", "data": { "phone": "Numéro invalide…" } }`
   */
  data?: Record<string, string> | null;
  timestamp?: string;
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Discipline d'une analyse, d'une catégorie, d'un bon d'examen ou d'un compte
 * rendu — réplique de l'enum backend `com.labo.anapath.common.Discipline`.
 */
export type Discipline = "PATHOLOGY" | "BIOLOGY";

/**
 * Nature d'une analyse de biologie — réplique de l'enum backend
 * `com.labo.anapath.biology.BiologyKind`. Toujours `null` en anatomie
 * pathologique ; figée à la création.
 *
 *   PANEL    fiche de paramètres (NFS, ionogramme…)
 *   CULTURE  culture bactériologique (options de culture, antibiogramme)
 */
export type BiologyKind = "PANEL" | "CULTURE";
