"use client";

import { useEffect, useState } from "react";
import { cabinetAppUrl } from "@/lib/cabinet-link";

export function CabinetLink({
  hash,
  children,
  beforeOpen,
}: {
  hash: string;
  children: React.ReactNode;
  beforeOpen?: () => Promise<boolean>;
}) {
  const [href, setHref] = useState("#");

  useEffect(() => {
    setHref(cabinetAppUrl(hash));
  }, [hash]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!beforeOpen) return;
        event.preventDefault();
        void beforeOpen().then((ok) => {
          if (ok) window.open(cabinetAppUrl(hash), "_blank", "noopener,noreferrer");
        });
      }}
    >
      {children}
    </a>
  );
}
