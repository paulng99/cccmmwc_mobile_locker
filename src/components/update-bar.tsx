"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
  const fileRef = useRef<HTMLInputElement>(null);
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

  function failMessage(code?: string) {
    if (code === "missing_session") return t("missingSession");
    if (code === "need_locker_login") return t("needLockerLogin");
    return t("proxyFail");
  }

  async function importWorkbook(file: Blob, filename: string) {
    const form = new FormData();
    form.append("file", file, filename);
    const imported = await fetch("/api/import", { method: "POST", body: form });
    const result = (await imported.json()) as { ok?: boolean; inserted?: number; error?: string };
    if (!imported.ok) throw new Error(result.error ?? "import_failed");
    setMessage(result.inserted ? t("updateOk", { count: result.inserted }) : t("updateNone"));
    await load();
  }

  async function update() {
    if (!settings) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const reachable = await probeIntranet(settings.intranetBaseUrl);
    setOnline(reachable);
    if (reachable) {
      try {
        const excel = await fetchExcelFromIntranet({
          baseUrl: settings.intranetBaseUrl,
          exportApiPath: settings.exportApiPath,
          storageKey: settings.sessionStorageKey,
          sessionInput: settings.sessionPayload,
          from: settings.from,
          to: settings.to,
        });
        await importWorkbook(
          new Blob([excel], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          "openlog.xlsx",
        );
        setBusy(false);
        return;
      } catch {
        setMessage(t("corsFail"));
      }
    }
    try {
      const proxy = await fetch("/api/sync/proxy", { method: "POST" });
      const result = (await proxy.json()) as { ok?: boolean; inserted?: number; error?: string };
      if (!proxy.ok) {
        setError(failMessage(result.error));
        setMessage(null);
      } else {
        setMessage(result.inserted ? t("updateOk", { count: result.inserted }) : t("updateNone"));
        await load();
      }
    } catch {
      setError(reachable ? t("proxyFail") : t("intranetFail"));
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await importWorkbook(file, file.name);
    } catch {
      setError(t("uploadFail"));
    } finally {
      setBusy(false);
    }
  }

  const lockerUrl = settings?.intranetBaseUrl
    ? settings.intranetBaseUrl.replace(/\/$/, "")
    : "http://10.127.7.200:17789";

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
        <button className="secondary" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          {t("uploadExcel")}
        </button>
        <input
          ref={fileRef}
          className="file-input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={onUpload}
        />
      </div>
      <p className="hint">
        {t("uploadHint")}{" "}
        <a href={lockerUrl} target="_blank" rel="noreferrer">
          {t("openLocker")}
        </a>
      </p>
      {message ? <p className="okmsg">{message}</p> : null}
      {error ? <p className="alert">{error}</p> : null}
    </section>
  );
}
