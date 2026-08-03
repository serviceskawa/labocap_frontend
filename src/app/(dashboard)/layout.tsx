import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";
import { AuthGuard } from "@/components/common/AuthGuard";
import { AppSettingsEffects } from "@/components/layout/AppSettingsEffects";
import { TimeoffRequestModal } from "@/components/hr/TimeoffRequestModal";
import { HyperTooltip } from "@/components/common/HyperTooltip";
import { AutoPlaceholders } from "@/components/common/AutoPlaceholders";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppSettingsEffects />
      {/* En impression : on masque la coque (sidebar/topbar/footer) et on
          neutralise les contraintes de hauteur/scroll qui tronquent la page,
          pour n'imprimer que le contenu (ex. récapitulatif de caisse). */}
      <div className="flex h-screen overflow-hidden bg-gray-50 print:block print:h-auto print:overflow-visible">
        <div className="contents print:hidden">
          <Sidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible">
          <div className="print:hidden">
            <Topbar />
          </div>
          <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
            {children}
          </main>
          <div className="print:hidden">
            <Footer />
          </div>
        </div>
      </div>
      {/* Modal global « Ajouter un congé » — ouvrable depuis n'importe quelle page. */}
      <TimeoffRequestModal />

      {/* Infobulles globales façon Hyper + placeholders auto sur tous les champs. */}
      <HyperTooltip />
      <AutoPlaceholders />
    </AuthGuard>
  );
}
