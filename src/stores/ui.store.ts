import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /**
   * Ouverture du menu latéral en overlay sur petit écran (< 768px), équivalent
   * de la classe `sidebar-enable` du thème Hyper. Non persisté : toujours fermé
   * au chargement d'une page (comme Laravel).
   */
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  /**
   * Groupes du menu latéral repliés, par libellé.
   *
   * Persisté au même titre que `sidebarCollapsed` : sur un menu de trente
   * entrées, replier les rubriques dont on ne se sert pas n'a d'intérêt que si
   * le réglage survit au rechargement. Chacun se taille ainsi son menu.
   *
   * On stocke les groupes REPLIÉS et non les ouverts : par défaut tout est
   * ouvert, et une rubrique ajoutée plus tard apparaît donc d'emblée, sans
   * qu'il faille migrer l'état enregistré.
   */
  collapsedGroups: string[];
  toggleGroup: (label: string) => void;
  /** Modal global « Ajouter un congé » (calque de employee_timeoffs/create2). */
  timeoffModalOpen: boolean;
  /** Employé pré-sélectionné à l'ouverture (ex. depuis une fiche employé). */
  timeoffPresetEmployeeId: string | null;
  openTimeoffModal: (presetEmployeeId?: string) => void;
  closeTimeoffModal: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      mobileSidebarOpen: false,
      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      collapsedGroups: [],
      toggleGroup: (label) =>
        set((state) => ({
          collapsedGroups: state.collapsedGroups.includes(label)
            ? state.collapsedGroups.filter((l) => l !== label)
            : [...state.collapsedGroups, label],
        })),
      timeoffModalOpen: false,
      timeoffPresetEmployeeId: null,
      openTimeoffModal: (presetEmployeeId) =>
        set({ timeoffModalOpen: true, timeoffPresetEmployeeId: presetEmployeeId ?? null }),
      closeTimeoffModal: () =>
        set({ timeoffModalOpen: false, timeoffPresetEmployeeId: null }),
    }),
    {
      name: "ui-storage",
      // On ne persiste QUE l'état de la sidebar (un modal ne doit pas se
      // rouvrir tout seul au rechargement).
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedGroups: state.collapsedGroups,
      }),
    }
  )
);
