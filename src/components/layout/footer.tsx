"use client";

import { useAppSettings } from "@/hooks/useAppSettings";
import { DEFAULT_APP_NAME } from "@/hooks/useBranding";

export function Footer() {
  const { data } = useAppSettings();
  const year = new Date().getFullYear();
  // Fidèle à Laravel : « {année} © {paramètre `footer`} ». Repli sur le nom du
  // labo si le réglage `footer` n'est pas défini.
  const footerText =
    data?.footer?.trim() || data?.app_name?.trim() || DEFAULT_APP_NAME;
  return (
    <footer className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 text-center text-sm text-gray-500">
      {year} © {footerText}
    </footer>
  );
}
