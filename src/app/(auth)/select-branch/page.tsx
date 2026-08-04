"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle,
  Loader2,
  LogOut,
  MapPin,
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { branchesApi, UserBranch } from "@/lib/api/branches";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";

/**
 * Écran de sélection de la branche (agence/site) active — portage de la page
 * `select-branch.blade.php` de Laravel.
 *
 * Reproduit le comportement d'origine : grille de cartes de branches,
 * auto-sélection de la branche par défaut, bouton de
 * confirmation désactivé tant qu'aucune branche n'est choisie, lien de
 * déconnexion. À la confirmation, la branche est mémorisée (cookie + store) puis
 * l'utilisateur est redirigé vers le tableau de bord.
 */
export default function SelectBranchPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setBranch = useBranchStore((state) => state.setBranch);

  const [branches, setBranches] = useState<UserBranch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    branchesApi
      .getMyBranches()
      .then((res) => {
        if (!active) return;
        const list = res.data ?? [];
        // Un utilisateur mono-branche n'a rien à choisir : on sélectionne
        // automatiquement sa branche et on file au tableau de bord, sans jamais
        // afficher le panneau de sélection (le spinner reste le temps de rediriger).
        if (list.length === 1) {
          setBranch({ id: list[0].id, name: list[0].name });
          router.replace("/home");
          return;
        }
        setBranches(list);
        // Auto-sélection de la branche par défaut (comme le JS du blade).
        const def = list.find((b) => b.isDefault) ?? list[0];
        if (def) setSelectedId(def.id);
        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          toast.error("Impossible de charger vos branches.");
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router, setBranch]);

  const handleConfirm = () => {
    const branch = branches.find((b) => b.id === selectedId);
    if (!branch) {
      toast.error("Veuillez sélectionner une branche");
      return;
    }
    setIsSubmitting(true);
    setBranch({ id: branch.id, name: branch.name });
    router.push("/home");
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // on ignore les erreurs de déconnexion
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-3xl w-full">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header avec logo */}
          <div className="bg-gray-50 px-8 py-6 text-center border-b">
            <AppLogo className="h-12 mx-auto" />
          </div>

          <div className="px-8 py-8">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-gray-800 mb-1">
                Bienvenue{user ? ` ${user.firstname} ${user.lastname}` : ""}
              </h4>
              <p className="text-gray-500 text-sm">
                Sélectionnez la branche avec laquelle vous souhaitez travailler
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : branches.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">
                Aucune branche ne vous est affectée. Contactez un administrateur.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-4">
                  {branches.map((branch) => {
                    const selected = branch.id === selectedId;
                    return (
                      <button
                        type="button"
                        key={branch.id}
                        onClick={() => setSelectedId(branch.id)}
                        className={`relative w-full sm:w-60 text-center rounded-lg border-2 p-5 transition-all min-h-[120px] ${
                          selected
                            ? "border-blue-600 bg-blue-50 shadow-md -translate-y-0.5"
                            : "border-gray-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5"
                        }`}
                      >
                        <Building2 className="mx-auto mb-3 h-10 w-10 text-blue-600" />
                        <h5 className="font-semibold text-gray-800 mb-1">
                          {branch.name}
                        </h5>
                        {branch.code && (
                          <p className="text-xs text-gray-500">{branch.code}</p>
                        )}
                        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {branch.location || "Adresse non définie"}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="text-center mt-6">
                  <Button
                    onClick={handleConfirm}
                    disabled={!selectedId}
                    loading={isSubmitting}
                    icon={<CheckCircle className="h-4 w-4" />}
                    className="rounded px-6 py-2.5 text-sm font-medium hover:bg-blue-700"
                  >
                    {isSubmitting
                      ? "Connexion en cours..."
                      : "Continuer vers le tableau de bord"}
                  </Button>
                </div>

                <p className="text-center mt-3 text-xs text-gray-400">
                  Vous pourrez changer de branche ultérieurement depuis votre
                  profil
                </p>
              </>
            )}
          </div>
        </div>

        {/* Déconnexion */}
        <p className="text-center mt-4 text-sm">
          {/* Handler asynchrone : le Button gère seul son spinner et bloque un
              second clic pendant l'appel de déconnexion. */}
          <Button
            variant="secondary"
            onClick={handleLogout}
            icon={<LogOut className="h-4 w-4" />}
            className="gap-1 border-0 bg-transparent px-0 py-0 text-gray-500 hover:bg-transparent hover:text-gray-700"
          >
            Se déconnecter
          </Button>
        </p>
      </div>
    </div>
  );
}
