"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { formatHkDateTime } from "@/lib/open-log";

export function Shell({
  children,
  loginName,
}: {
  children: React.ReactNode;
  loginName?: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () => setNow(formatHkDateTime(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = pathname.startsWith("/en") ? "/en/login" : "/zh-HK/login";
  }
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand">{t("appName")}</div>
          <time className="hk-clock" dateTime={now || undefined}>
            {now ? `${now} HKT` : t("nowHkt")}
          </time>
        </div>
        <nav className="nav">
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            {t("students")}
          </Link>
          <Link href="/lockers" className={pathname.startsWith("/lockers") ? "active" : ""}>
            {t("lockers")}
          </Link>
          <Link href="/settings" className={pathname.startsWith("/settings") ? "active" : ""}>
            {t("settings")}
          </Link>
          <span className="lang">
            <Link href={pathname} locale="zh-HK">
              繁
            </Link>
            <Link href={pathname} locale="en">
              EN
            </Link>
          </span>
          {loginName ? (
            <button type="button" onClick={logout}>
              {t("logout")}
            </button>
          ) : null}
        </nav>
      </header>
      {children}
    </div>
  );
}
