"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchExcelFromIntranet, probeIntranet } from "@/lib/intranet";

type Settings = {
  intranetBaseUrl: string;
  sessionStorageKey: string;
  sessionPayload: string;
  hasSession: boolean;
  exportApiPath: string;
  from: string;
  to: string;
  lastSuccessAt: string | null;
};

export function UpdateBar() {
  const t = useTranslations();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/settings");
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await response.json()) as Settings;
    setSettings(data);
    setOnline(await probeIntranet(data.intranetBaseUrl));
  }

  useEffect(() => {
    void load();
  }, []);

  async function update() {
    if (!settings) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const reachable = await probeIntranet(settings.intranetBaseUrl);
    setOnline(reachable);
    if (!reachable) {
      setError(t("intranetFail"));
      setBusy(false);
      return;
    }
    if (!settings.hasSession && !settings.sessionPayload) {
      setError(t("missingSession"));
      setBusy(false);
      return;
    }
    try {
      const excel = await fetchExcelFromIntranet({
        baseUrl: settings.intranetBaseUrl,
        exportApiPath: settings.exportApiPath,
        storageKey: settings.sessionStorageKey,
        sessionInput: settings.sessionPayload,
        from: settings.from,
        to: settings.to,
      });
      const form = new FormData();
      form.append("file", new Blob([excel], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "openlog.xlsx");
      const imported = await fetch("/api/import", { method: "POST", body: form });
      const result = (await imported.json()) as { ok?: boolean; inserted?: number; error?: string };
      if (!imported.ok) throw new Error(result.error ?? "import_failed");
      setMessage(result.inserted ? t("updateOk", { count: result.inserted }) : t("updateNone"));
      await load();
    } catch {
      setMessage(t("corsFail"));
      const proxy = await fetch("/api/sync/proxy", { method: "POST" });
      const result = (await proxy.json()) as { ok?: boolean; inserted?: number; error?: string };
      if (!proxy.ok) {
        setError(result.error === "missing_session" ? t("missingSession") : t("proxyFail"));
        setMessage(null);
      } else {
        setMessage(result.inserted ? t("updateOk", { count: result.inserted }) : t("updateNone"));
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="sync-row">
        <span className={`badge ${online ? "ok" : "warn"}`}>
          {online ? t("intranetOk") : t("intranetFail")}
        </span>
        <span>
          {t("dateRange")}: {settings ? `${settings.from} → ${settings.to}` : "…"}
        </span>
        <span>
          {t("lastSync")}: {settings?.lastSuccessAt ? settings.lastSuccessAt.slice(0, 19).replace("T", " ") : t("never")}
        </span>
        <button className="primary" type="button" onClick={update} disabled={busy}>
          {busy ? t("updating") : t("update")}
        </button>
      </div>
      {message ? <p className="okmsg">{message}</p> : null}
      {error ? <p className="alert">{error}</p> : null}
    </section>
  );
}
