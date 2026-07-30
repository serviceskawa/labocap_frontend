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
