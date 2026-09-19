"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

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
  const locale = useLocale();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (response.ok) setSaved(true);
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
      <p className="hint">{t("exportMappingHint")}</p>
      <div className="sync-row">
        <a className="primary" href={`/api/export/student-lockers?locale=${locale}`}>
          {t("exportExcel")}
        </a>
      </div>
    </section>
    </>
  );
}
