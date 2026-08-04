"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import apiClient from "@/lib/api/client";

/**
 * Vignette d'image récupérée de façon authentifiée (cookies via apiClient) et
 * exposée en `blob:` — le chemin backend n'apparaît jamais dans le DOM et le
 * endpoint /files/** protégé par JWT reçoit bien les cookies.
 *
 * Réplique la galerie « Pièces jointes » de la vue Laravel reports/show.
 */
export function AuthThumbnail({
  filename,
  alt,
  onClick,
  className,
}: {
  filename: string;
  alt?: string;
  onClick?: () => void;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    apiClient
      .get(`/files/${filename}`, { responseType: "blob" })
      .then((res) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename]);

  if (failed) {
    return (
      <div
        className={`flex h-[75px] w-[75px] flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-gray-200 bg-gray-50 text-gray-400 ${className ?? ""}`}
        title={alt}
      >
        <ImageOff className="h-4 w-4" />
        <span className="text-[9px]">Introuvable</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`h-[75px] w-[75px] animate-pulse rounded-[var(--radius-control)] border border-gray-200 bg-gray-100 ${className ?? ""}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      className={`h-[75px] w-[75px] cursor-pointer rounded-[var(--radius-control)] border border-gray-200 object-cover p-1 transition-transform hover:scale-105 ${className ?? ""}`}
    />
  );
}
