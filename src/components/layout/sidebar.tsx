"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Stethoscope,
  FileCheck,
  Building2,
  Users,
  User,
  Receipt,
  DollarSign,
  Folder,
  TrendingDown,
  Package,
  Truck,
  RefreshCw,
  Briefcase,
  AlertCircle,
  UserCheck,
  Settings,
  Users2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Syringe,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/usePermissions";
import { useBranding } from "@/hooks/useBranding";
import { AppLogo } from "@/components/ui/AppLogo";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { testOrdersApi } from "@/lib/api/testOrders";
import { inventoryApi } from "@/lib/api/inventory";
import { refundsApi } from "@/lib/api/refunds";
import { invoicesApi } from "@/lib/api/invoices";
import { cashboxApi } from "@/lib/api/cashbox";
import { supportApi } from "@/lib/api/support";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BadgeProps {
  count: number;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
}

interface CollapseItemProps {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
  children: React.ReactNode;
}

interface SubItemProps {
  /** Lien de navigation. Omettre et fournir `onClick` pour un déclencheur (ex. modal). */
  href?: string;
  label: string;
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Badge({ count }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
      {count}
    </span>
  );
}

function NavItem({ href, icon, label, collapsed, badge = 0 }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center px-4 py-2.5 rounded-[var(--radius-control)] mx-2 transition-colors text-[.9rem] ${
        collapsed ? "justify-center" : "gap-3"
      } ${
        isActive
          ? "bg-blue-600 text-white shadow-[0_2px_8px_-2px_rgba(46,75,216,0.55)]"
          : "text-sidebar-link hover:bg-white/[0.06] hover:text-sidebar-link-hover"
      }`}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          <Badge count={badge} />
        </>
      )}
    </Link>
  );
}

function CollapseItem({
  icon,
  label,
  collapsed,
  badge = 0,
  children,
}: CollapseItemProps) {
  const [open, setOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);

  if (collapsed) {
    // En mode replié, on affiche un flyout au survol (positionné en `fixed` pour
    // échapper au `overflow-hidden` de la sidebar) listant les sous-éléments,
    // afin que les sections à enfants restent accessibles.
    return (
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setFlyoutTop(rect.top);
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
      >
        <div
          className="flex items-center justify-center px-4 py-2.5 mx-2 text-sidebar-link cursor-pointer hover:bg-white/[0.06] hover:text-sidebar-link-hover rounded-[var(--radius-control)] transition-colors"
          title={label}
        >
          <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        </div>
        {open && (
          // `pl-1` sert de pont de survol entre l'icône et le panneau.
          <div className="fixed left-16 z-50 pl-1" style={{ top: flyoutTop }}>
            <div className="min-w-[210px] rounded-[var(--radius-surface)] border border-white/10 bg-gray-900 py-2 shadow-[var(--elevation-overlay)]">
              <div className="px-4 pb-2 mb-1 border-b border-white/10 text-xs uppercase tracking-wider text-sidebar-link font-semibold">
                {label}
              </div>
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-control)] mx-2 w-[calc(100%-16px)] text-left text-[.9375rem] text-sidebar-link hover:bg-white/5 hover:text-sidebar-link-hover transition-colors"
      >
        <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <Badge count={badge} />
        <span className="flex-shrink-0 ml-1">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-white/15 mt-0.5 mb-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SubItem({ href, label, onClick }: SubItemProps) {
  const pathname = usePathname();
  const isActive = !!href && pathname === href;
  const cls = `flex w-full items-center pl-8 pr-4 py-2 text-left text-[.9375rem] transition-colors ${
    isActive
      ? "text-white bg-white/[0.07] rounded-r-lg"
      : "text-sidebar-link hover:text-sidebar-link-hover hover:bg-white/[0.05] rounded-r-lg"
  }`;

  // Déclencheur (ex. modal global) : bouton au lieu d'un lien.
  if (!href) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}

function SectionLabel({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="mx-2 my-2 border-t border-white/15" />;
  }
  return (
    <div className="px-4 mt-5 mb-2">
      <span className="text-[.6875rem] uppercase text-gray-500 font-semibold tracking-[0.08em]">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const { can } = usePermissions();
  const { openTimeoffModal } = useUIStore();
  const pathname = usePathname();

  // À la navigation (clic sur un lien du menu), on referme le menu overlay mobile
  // — comme Laravel où le menu se masque après le choix d'une entrée sur petit écran.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Détection du petit écran (< 768px). Sur mobile, le menu est TOUJOURS déployé
  // (libellés visibles) : le mode réduit « condensed » est réservé au desktop,
  // exactement comme dans Laravel/Hyper.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767.98px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { data: immunoPendingCount } = useQuery({
    queryKey: ["immuno-pending-count"],
    queryFn: () => testOrdersApi.countImmunoPending().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_TEST_ORDERS),
    refetchOnWindowFocus: false,
  });

  // Badge « Stocks » : articles ayant atteint le stock minimum (getnbrStockMinim).
  const { data: stockMinimumCount } = useQuery({
    queryKey: ["stock-minimum-count"],
    queryFn: () => inventoryApi.countStockMinimum().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_ARTICLES),
    refetchOnWindowFocus: false,
  });

  // Badge « Remboursements » : demandes en attente (getnbrRefundRequestPending).
  const { data: refundPendingCount } = useQuery({
    queryKey: ["refund-pending-count"],
    queryFn: () => refundsApi.countPending().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_REFUNDS),
    refetchOnWindowFocus: false,
  });

  // Badge « Demandes d'examen » : bons cyto/histo en attente (getnbrTestOrderpending).
  const { data: testOrderPendingCount } = useQuery({
    queryKey: ["test-order-pending-count"],
    queryFn: () => testOrdersApi.countPending().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_TEST_ORDERS),
    refetchOnWindowFocus: false,
  });

  // Badge « Factures » : factures non réglées (getnbrInvoicepending).
  const { data: invoicePendingCount } = useQuery({
    queryKey: ["invoice-pending-count"],
    queryFn: () => invoicesApi.countUnpaid().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_INVOICES),
    refetchOnWindowFocus: false,
  });

  // Badge « Caisses » : bons de caisse en attente (getnbrBonCaissePending).
  const { data: voucherPendingCount } = useQuery({
    queryKey: ["cashbox-voucher-pending-count"],
    queryFn: () => cashboxApi.countPendingVouchers().then((r) => r.data.count),
    enabled: can(PERMISSIONS.VIEW_CASHBOXES),
    refetchOnWindowFocus: false,
  });

  // Badge « Signaler un problème » : tickets ouverts (getnbrTicketPending).
  const { data: ticketOpenCount } = useQuery({
    queryKey: ["ticket-open-count"],
    queryFn: () => supportApi.countOpen().then((r) => r.data.count),
    refetchOnWindowFocus: false,
  });

  // Sur mobile, jamais réduit : on affiche toujours les libellés (comme Laravel).
  const collapsed = isMobile ? false : sidebarCollapsed;

  // Logo + nom du labo depuis les Paramètres, avec repli sur la route publique
  // `/public/branding` : `/setting-apps` exige la permission `view-settings`, si
  // bien qu'un technicien ne voyait jusqu'ici que l'initiale de repli.
  const { appName, logo, logoWhite } = useBranding();

  return (
    <>
      {/* Fond assombri sous 768px quand le menu overlay est ouvert (Hyper). */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "hyper-sidebar text-white flex flex-col overflow-hidden",
          "transition-[transform,width] duration-[var(--duration-slow)] ease-emphasized",
          // Mobile (< 768px) : menu hors écran par défaut, en overlay fixe une
          // fois ouvert — calque de `.leftside-menu { display:none }` +
          // `.sidebar-enable .leftside-menu` du thème Hyper.
          // z-40 : sous la topbar (z-50) pour que le hamburger reste visible,
          // au-dessus du fond assombri (z-30) — comme Hyper (navbar 1001 / menu 10).
          "fixed inset-y-0 left-0 z-40 w-64",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop (>= 768px) : dans le flux, largeur pilotée par le mode réduit.
          "md:static md:z-auto md:translate-x-0 md:flex-shrink-0",
          collapsed ? "md:w-16" : "md:w-64",
        ].join(" ")}
      >
      {/* Logo — depuis les paramètres (setting_apps.logo), repli sur l'initiale. */}
      <div className="h-[70px] flex items-center justify-center flex-shrink-0 border-b border-white/15">
        {collapsed ? (
          <AppLogo
            surface="dark"
            fallback="initial"
            className="h-9 w-9 rounded-[var(--radius-control)]"
          />
        ) : (
          <div className="flex items-center gap-2 px-4">
            {/* Deux compositions distinctes, et non un logo suivi du nom en
                toutes circonstances :
                  — logo téléversé  → l'image, puis la raison sociale à côté ;
                  — aucun logo      → la marque LaboAnaPath seule.
                Accoler la lettrine au nom donnerait « [L] LaboAnaPath », soit
                l'initiale répétée juste avant le mot qu'elle abrège. */}
            {logo || logoWhite ? (
              <>
                <AppLogo
                  surface="dark"
                  fallback="initial"
                  className="h-9 w-auto max-w-[90px] rounded-[var(--radius-control)] flex-shrink-0"
                  fallbackClassName="flex-shrink-0"
                />
                <span className="truncate text-base font-semibold text-white">
                  {appName}
                </span>
              </>
            ) : (
              <AppLogo surface="dark" fallback="name" className="text-lg" />
            )}
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 overflow-x-hidden">

        {/* ══════════════ TABLEAU DE BORD ══════════════ */}
        <SectionLabel label="TABLEAU DE BORD" collapsed={collapsed} />

        <NavItem href="/home" icon={<Home className="w-5 h-5" />} label="Tableau de bord" collapsed={collapsed} />

        {/* ══════════════ EXAMENS ══════════════ */}
        <SectionLabel label="EXAMENS" collapsed={collapsed} />

        {/* Catalogue d'examens */}
        {can(PERMISSIONS.VIEW_TESTS) && (
          <CollapseItem icon={<FlaskConical className="w-5 h-5" />} label="Catalogue d'examens" collapsed={collapsed}>
            {can(PERMISSIONS.VIEW_TESTS) && <SubItem href="/examens" label="Tous les examens" />}
            {can(PERMISSIONS.VIEW_CATEGORY_TESTS) && <SubItem href="/examens/categories" label="Catégories" />}
          </CollapseItem>
        )}

        {/* Demandes d'examen */}
        {can(PERMISSIONS.VIEW_TEST_ORDERS) && (
          <CollapseItem
            icon={<Stethoscope className="w-5 h-5" />}
            label="Demandes d'examen"
            collapsed={collapsed}
            badge={testOrderPendingCount ?? 0}
          >
            {/* Laravel affiche « Mon espace » à tout utilisateur du menu Demandes
                d'examen (app2.blade.php) : pas de restriction au rôle Docteur. */}
            <SubItem href="/test-orders/myspace" label="Mon espace" />
            <SubItem href="/test-orders" label="Toutes les demandes" />
            {/* NB : « Ajouter » (route test_order.create) est commenté dans
                app2.blade.php : absent des deux menus, pas un écart. La page
                /test-orders/create reste atteignable depuis la liste. */}
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/test-orders/macroscopy" label="Macroscopie" />
            )}
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/test-orders/assignments" label="Affectation" />
            )}
            {can(PERMISSIONS.VIEW_TEST_ORDER_ASSIGNMENTS) && (
              <SubItem href="/reports/suivi" label="Suivi des demandes" />
            )}
            <SubItem href="/search" label="Rechercher" />
          </CollapseItem>
        )}

        {/* Immuno */}
        {can(PERMISSIONS.VIEW_TEST_ORDERS) && (
          <NavItem
            href="/test-orders/immuno"
            icon={<Syringe className="w-5 h-5" />}
            label="Immuno"
            collapsed={collapsed}
            badge={immunoPendingCount ?? 0}
          />
        )}

        {/* Comptes rendu */}
        {can(PERMISSIONS.VIEW_REPORTS) && (
          <CollapseItem icon={<FileCheck className="w-5 h-5" />} label="Comptes rendu" collapsed={collapsed}>
            <SubItem href="/reports" label="Tous les comptes rendu" />
            {can(PERMISSIONS.VIEW_SETTINGS) && <SubItem href="/reports/templates" label="Templates" />}
            <SubItem href="/reports/history" label="Historiques" />
            {can(PERMISSIONS.VIEW_SETTINGS) && <SubItem href="/reports/settings" label="Paramètres" />}
          </CollapseItem>
        )}

        {/* Hôpitaux */}
        {can(PERMISSIONS.VIEW_HOSPITALS) && (
          <NavItem href="/hospitals" icon={<Building2 className="w-5 h-5" />} label="Hôpitaux" collapsed={collapsed} />
        )}

        {/* Médecins */}
        {can(PERMISSIONS.VIEW_DOCTORS) && (
          <NavItem href="/doctors" icon={<Users className="w-5 h-5" />} label="Médecins traitants" collapsed={collapsed} />
        )}

        {/* Patients */}
        {can(PERMISSIONS.VIEW_PATIENTS) && (
          <NavItem href="/patients" icon={<User className="w-5 h-5" />} label="Patients" collapsed={collapsed} />
        )}

        {/* NB : « Consultations » et « Prestations » sont volontairement absents du
            menu — comme dans la navigation Laravel (app2.blade.php), qui n'expose pas
            ces modules dans la sidebar (les routes existent mais pas l'entrée de menu). */}

        {/* ══════════════ COMPTABILITÉS ══════════════ */}
        <SectionLabel label="COMPTABILITÉS" collapsed={collapsed} />

        {/* Factures */}
        {can(PERMISSIONS.VIEW_INVOICES) && (
          <CollapseItem
            icon={<Receipt className="w-5 h-5" />}
            label="Factures"
            collapsed={collapsed}
            badge={invoicePendingCount ?? 0}
          >
            <SubItem href="/invoices" label="Toutes les Factures" />
            <SubItem href="/invoices/create" label="Créer" />
            {/* NB : « Rapports » et « Paramètre » sont volontairement absents, à la
                demande du métier — écart assumé vis-à-vis de Laravel (app2.blade.php),
                qui les expose sous permission view-setting-invoice. Les routes
                /invoices/business et /invoices/settings restent accessibles par URL. */}
          </CollapseItem>
        )}

        {/* Caisses */}
        {can(PERMISSIONS.VIEW_CASHBOXES) && (
          <CollapseItem
            icon={<DollarSign className="w-5 h-5" />}
            label="Caisses"
            collapsed={collapsed}
            badge={voucherPendingCount ?? 0}
          >
            <SubItem href="/cashbox/vente" label="Caisse de vente" />
            <SubItem href="/cashbox/depense" label="Caisse de dépense" />
            <SubItem href="/cashbox/ticket" label="Bon de caisse" />
            <SubItem href="/cashbox/cashbox-daily" label="Ouverture et fermeture" />
          </CollapseItem>
        )}

        {/* Contrats */}
        {can(PERMISSIONS.VIEW_CONTRATS) && (
          <NavItem href="/contracts" icon={<Folder className="w-5 h-5" />} label="Contrats" collapsed={collapsed} />
        )}

        {/* Dépenses */}
        {can(PERMISSIONS.VIEW_EXPENSES) && (
          <CollapseItem icon={<TrendingDown className="w-5 h-5" />} label="Dépenses" collapsed={collapsed}>
            <SubItem href="/expenses" label="Toutes les dépenses" />
            {can(PERMISSIONS.MANAGE_SETTINGS) && (
              <SubItem href="/expenses/categories" label="Catégories" />
            )}
          </CollapseItem>
        )}

        {/* Stocks */}
        {can(PERMISSIONS.VIEW_ARTICLES) && (
          <CollapseItem
            icon={<Package className="w-5 h-5" />}
            label="Stocks"
            collapsed={collapsed}
            badge={stockMinimumCount ?? 0}
          >
            {can(PERMISSIONS.VIEW_MOVEMENTS) && (
              <SubItem href="/inventory/movements" label="Historique des stocks" />
            )}
            <SubItem href="/inventory/articles" label="Tous les articles" />
            <SubItem href="/inventory/units" label="Unité de mesure" />
          </CollapseItem>
        )}

        {/* Fournisseurs */}
        {can(PERMISSIONS.VIEW_SUPPLIERS) && (
          <CollapseItem icon={<Truck className="w-5 h-5" />} label="Fournisseurs" collapsed={collapsed}>
            <SubItem href="/suppliers" label="Tous les fournisseurs" />
            <SubItem href="/suppliers/categories" label="Catégories" />
          </CollapseItem>
        )}

        {/* Remboursements */}
        {can(PERMISSIONS.VIEW_REFUNDS) && (
          <CollapseItem
            icon={<RefreshCw className="w-5 h-5" />}
            label="Remboursements"
            collapsed={collapsed}
            badge={refundPendingCount ?? 0}
          >
            <SubItem href="/refunds" label="Historiques" />
            <SubItem href="/refunds/create" label="Ajouter" />
            <SubItem href="/refunds/settings" label="Paramètres" />
          </CollapseItem>
        )}

        {/* Clients Professionnels */}
        {can(PERMISSIONS.VIEW_CLIENTS) && (
          <NavItem href="/clients" icon={<Briefcase className="w-5 h-5" />} label="Clients Professionnels" collapsed={collapsed} />
        )}

        {/* ══════════════ ADMINISTRATIONS ══════════════ */}
        <SectionLabel label="ADMINISTRATIONS" collapsed={collapsed} />

        {/* Signaler un problème */}
        <CollapseItem
          icon={<AlertCircle className="w-5 h-5" />}
          label="Signaler un problème"
          collapsed={collapsed}
          badge={ticketOpenCount ?? 0}
        >
          <SubItem href="/support" label="Historiques" />
          <SubItem href="/support/signaler" label="Signaler" />
        </CollapseItem>

        {/* Utilisateurs */}
        {can(PERMISSIONS.VIEW_USERS) && (
          <CollapseItem icon={<UserCheck className="w-5 h-5" />} label="Utilisateurs" collapsed={collapsed}>
            {can(PERMISSIONS.VIEW_USERS) && <SubItem href="/settings/permissions" label="Permissions" />}
            {can(PERMISSIONS.MANAGE_ROLES) && <SubItem href="/settings/roles" label="Rôles" />}
            {can(PERMISSIONS.VIEW_USERS) && <SubItem href="/settings/users" label="Tous les utilisateurs" />}
          </CollapseItem>
        )}

        {/* Paramètres */}
        {can(PERMISSIONS.VIEW_SETTINGS) && (
          <NavItem href="/settings" icon={<Settings className="w-5 h-5" />} label="Paramètres" collapsed={collapsed} />
        )}

        {/* ══════════════ EQUIPES ══════════════ */}
        <SectionLabel label="EQUIPES" collapsed={collapsed} />

        {/* Noms calqués sur le menu Laravel (layouts/app2 : EQUIPES) :
            Tous les employés / Demande de congé / Toutes les demandes.
            Laravel n'a aucune entrée « Paie » (la paie vit dans la fiche employé).
            Seul « Tous les employés » est sous permission (view-employees) ; les deux
            entrées de congés sont ouvertes à tous, sinon un employé sans droit RH ne
            peut plus déposer sa propre demande de congé. */}
        <CollapseItem icon={<Users2 className="w-5 h-5" />} label="Equipes" collapsed={collapsed}>
          {can(PERMISSIONS.VIEW_EMPLOYEES) && (
            <SubItem href="/hr/employees" label="Tous les employés" />
          )}
          <SubItem label="Demande de congé" onClick={openTimeoffModal} />
          <SubItem href="/hr/timeoff" label="Toutes les demandes" />
        </CollapseItem>

        {/* ══════════════ DOCUMENTATIONS ══════════════ */}
        <SectionLabel label="DOCUMENTATIONS" collapsed={collapsed} />

        {/* Structure identique à Laravel (app2.blade.php) : seul « Tous les
            documents » est protégé (view-docs) ; « Partagé avec moi » et
            « Toutes les catégories » sont visibles par tous ; pas de corbeille. */}
        <CollapseItem icon={<BookOpen className="w-5 h-5" />} label="Documentations" collapsed={collapsed}>
          {can(PERMISSIONS.VIEW_DOCS) && <SubItem href="/docs" label="Tous les documents" />}
          <SubItem href="/docs/shared" label="Partagé avec moi" />
          <SubItem href="/docs/categories" label="Toutes les catégories" />
        </CollapseItem>

        {/* NB : pas d'entrée « Recherche » à la racine — Laravel n'expose
            « Rechercher » que sous « Demandes d'examen » (app2.blade.php), où
            elle figure déjà. Ce doublon a été retiré. */}

        {/* Bottom padding */}
        <div className="h-4" />
      </nav>
    </aside>
    </>
  );
}
