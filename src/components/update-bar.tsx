"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CabinetLink } from "@/components/cabinet-link";
import { fetchExcelFromIntranet, probeIntranet } from "@/lib/intranet";
import { formatHkDateTime } from "@/lib/open-log";

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

type ImportResult = {
  ok?: boolean;
  inserted?: number;
  total?: number;
  skipped?: number;
  error?: string;
};

type SyncNotice = {
  filename: string;
  inserted: number;
  total: number;
  skipped: number;
};

const SYNC_NOTICE_KEY = "locker-sync-notice";

function stashNotice(result: ImportResult, filename: string) {
  const notice: SyncNotice = {
    filename,
    inserted: result.inserted ?? 0,
    total: result.total ?? 0,
    skipped: result.skipped ?? 0,
  };
  sessionStorage.setItem(SYNC_NOTICE_KEY, JSON.stringify(notice));
}

export function UpdateBar() {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SyncNotice | null>(null);

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

  useEffect(() => {
    const raw = sessionStorage.getItem(SYNC_NOTICE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SYNC_NOTICE_KEY);
    try {
      setNotice(JSON.parse(raw) as SyncNotice);
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
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
    const result = (await imported.json()) as ImportResult;
    if (!imported.ok) throw new Error(result.error ?? "import_failed");
    stashNotice(result, filename);
    window.location.reload();
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
      const result = (await proxy.json()) as ImportResult;
      if (!proxy.ok) {
        setError(failMessage(result.error));
        setMessage(null);
      } else {
        stashNotice(result, "openlog.xlsx");
        window.location.reload();
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
          {t("lastSync")}: {settings?.lastSuccessAt ? `${formatHkDateTime(new Date(settings.lastSuccessAt))} HKT` : t("never")}
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
        <CabinetLink hash="#/Logs/OpenLog">{t("openLocker")}</CabinetLink>
      </p>
      {message ? <p className="okmsg">{message}</p> : null}
      {error ? <p className="alert">{error}</p> : null}
      {notice ? (
        <div className="sync-popup-backdrop">
          <div className="sync-popup" role="status" aria-live="polite">
            <h2>{t("syncPopupTitle")}</h2>
            <p className="file">{notice.filename}</p>
            <p>
              {t("syncPopupDetail", {
                inserted: notice.inserted,
                total: notice.total,
                skipped: notice.skipped,
              })}
            </p>
            <div className="bar" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
