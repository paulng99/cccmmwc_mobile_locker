"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type Row = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lastLockerCode: string;
  lastOpenedAt: string | null;
};

export function StudentTable() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/students?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as { rows: Row[] };
      setRows(data.rows ?? []);
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <section className="card">
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
      <table className="table">
        <thead>
          <tr>
            <th>{t("class")}</th>
            <th>{t("studentNo")}</th>
            <th>{t("studentName")}</th>
            <th>{t("lastLocker")}</th>
            <th>{t("lastUsed")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>{t("noRows")}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.studentNo}>
                <td>{row.classCode}</td>
                <td>{row.studentNo}</td>
                <td>{row.studentName ?? ""}</td>
                <td>{row.lastLockerCode || t("vacant")}</td>
                <td>{row.lastOpenedAt ?? t("vacant")}</td>
                <td>
                  <Link className="history" href={`/history?studentNo=${encodeURIComponent(row.studentNo)}`}>
                    {t("history")}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
