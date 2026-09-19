"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

export function Shell({
  children,
  loginName,
}: {
  children: React.ReactNode;
  loginName?: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = pathname.startsWith("/en") ? "/en/login" : "/zh-HK/login";
  }
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">{t("appName")}</div>
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
