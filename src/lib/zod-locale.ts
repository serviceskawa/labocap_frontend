import { z } from "zod";
import { fr } from "zod/locales";

/**
 * Messages de validation de zod en français.
 *
 * Sans cette configuration, tout contrôle qui n'a pas de message explicite
 * retombe sur la locale anglaise par défaut : un champ obligatoire laissé vide
 * (valeur `undefined`, avant même que `.min(1, "…")` ne s'applique) affichait
 * « Invalid input » ou « Required » sous le champ — signalé sur le formulaire
 * d'ajout d'un bon de caisse.
 *
 * Importé pour son effet de bord, une seule fois, depuis le layout racine.
 */
z.config(fr());
