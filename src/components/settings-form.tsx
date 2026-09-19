"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { CabinetLink } from "@/components/cabinet-link";
import { fetchFrpUserExcelFromIntranet, probeIntranet } from "@/lib/intranet";

type Settings = {
  intranetBaseUrl: string;
  sessionStorageKey: string;
  sessionPayload: string;
  exportApiPath: string;
  firstImportDate: string;
  doorsPerCabinet: number;
  unusedStudentNos: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (response.ok) setSaved(true);
  }

  function failMessage(code?: string) {
    if (code === "missing_session") return t("missingSession");
    if (code === "need_locker_login") return t("needLockerLogin");
    return t("importFrpFail");
  }

  async function importWorkbook(file: Blob, filename: string) {
    const body = new FormData();
    body.append("file", file, filename);
    const imported = await fetch("/api/import/frp-users", { method: "POST", body });
    const result = (await imported.json()) as { ok?: boolean; imported?: number; error?: string };
    if (!imported.ok) throw new Error(result.error ?? "import_failed");
    setMessage(t("importFrpOk", { count: result.imported ?? 0 }));
    setError(null);
  }

  async function importFromIntranet() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const reachable = await probeIntranet(form.intranetBaseUrl);
    if (reachable) {
      try {
        const excel = await fetchFrpUserExcelFromIntranet({
          baseUrl: form.intranetBaseUrl,
          sessionInput: form.sessionPayload,
        });
        await importWorkbook(
          new Blob([excel], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          "frp-user.xlsx",
        );
        setBusy(false);
        return;
      } catch {
        setMessage(t("corsFail"));
      }
    }
    try {
      const proxy = await fetch("/api/sync/frp-users", { method: "POST" });
      const result = (await proxy.json()) as { ok?: boolean; imported?: number; error?: string };
      if (!proxy.ok) {
        setError(failMessage(result.error));
        setMessage(null);
      } else {
        setMessage(t("importFrpOk", { count: result.imported ?? 0 }));
        setError(null);
      }
    } catch {
      setError(reachable ? t("importFrpFail") : t("intranetFail"));
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
      setError(t("importFrpFail"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBeforeOpen() {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      setError(t("saveFail"));
      return false;
    }
    setSaved(true);
    setError(null);
    return true;
  }

  return (
    <>
    <form className="card" onSubmit={onSubmit}>
      <h1>{t("settings")}</h1>
      {saved ? <p className="okmsg">{t("saved")}</p> : null}
      <label className="field">
        {t("intranetUrl")}
        <input value={form.intranetBaseUrl} onChange={(e) => setForm({ ...form, intranetBaseUrl: e.target.value })} />
      </label>
      <label className="field">
        {t("session")}
        <textarea
          rows={4}
          value={form.sessionPayload}
          onChange={(e) => setForm({ ...form, sessionPayload: e.target.value })}
          placeholder=".AspNetCore.Identity.Application=..."
        />
        <small>{t("sessionHint")}</small>
      </label>
      <label className="field">
        {t("exportPath")}
        <input value={form.exportApiPath} onChange={(e) => setForm({ ...form, exportApiPath: e.target.value })} />
      </label>
      <label className="field">
        {t("firstImport")}
        <input value={form.firstImportDate} onChange={(e) => setForm({ ...form, firstImportDate: e.target.value })} />
      </label>
      <label className="field">
        {t("doors")}
        <input
          type="number"
          min={1}
          max={120}
          value={form.doorsPerCabinet}
          onChange={(e) => setForm({ ...form, doorsPerCabinet: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        {t("unusedList")}
        <textarea
          rows={8}
          value={form.unusedStudentNos}
          onChange={(e) => setForm({ ...form, unusedStudentNos: e.target.value })}
          placeholder={"1C02\n1C23\n5A22"}
        />
        <small>{t("unusedHint")}</small>
      </label>
      <button className="primary" type="submit">
        {t("save")}
      </button>
    </form>
    <section className="card">
      <h2>{t("exportMapping")}</h2>
      <p className="hint">
        {t("exportMappingHint")}{" "}
        <CabinetLink hash="#/Users/FRPUser" beforeOpen={saveBeforeOpen}>
          {t("openFrpUser")}
        </CabinetLink>
      </p>
      <div className="sync-row">
        <button className="primary" type="button" onClick={importFromIntranet} disabled={busy}>
          {busy ? t("importing") : t("exportExcel")}
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
      {message ? <p className="okmsg">{message}</p> : null}
      {error ? <p className="alert">{error}</p> : null}
    </section>
    </>
  );
}
