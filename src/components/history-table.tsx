"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type Row = {
  id: string;
  openedAt: string;
  studentName: string | null;
  studentNo: string;
  classCode: string;
  lockerCode: string;
  openType: string;
  verifyMethod: string;
  adminName: string;
  remark: string;
};

export function HistoryTable() {
  const t = useTranslations();
  const search = useSearchParams();
  const studentNo = search.get("studentNo");
  const lockerCode = search.get("lockerCode");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (studentNo) params.set("studentNo", studentNo);
    if (lockerCode) params.set("lockerCode", lockerCode);
    void (async () => {
      const response = await fetch(`/api/history?${params.toString()}`);
      const data = (await response.json()) as { rows: Row[] };
      setRows(data.rows ?? []);
    })();
  }, [studentNo, lockerCode]);

  return (
    <section className="card">
      <p>
        <Link href="/">{t("back")}</Link>
      </p>
      <h1>{t("history")}</h1>
      <table className="table">
        <thead>
          <tr>
            <th>{t("openedAt")}</th>
            <th>{t("studentName")}</th>
            <th>{t("studentNo")}</th>
            <th>{t("class")}</th>
            <th>{t("lastLocker")}</th>
            <th>{t("openType")}</th>
            <th>{t("verify")}</th>
            <th>{t("admin")}</th>
            <th>{t("remark")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9}>{t("noRows")}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.openedAt}</td>
                <td>{row.studentName ?? ""}</td>
                <td>{row.studentNo}</td>
                <td>{row.classCode}</td>
                <td>{row.lockerCode}</td>
                <td>{row.openType}</td>
                <td>{row.verifyMethod}</td>
                <td>{row.adminName}</td>
                <td>{row.remark}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
