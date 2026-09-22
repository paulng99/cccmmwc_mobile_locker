"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatHkDate } from "@/lib/open-log";

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

type SortKey = "openedAt" | "studentName" | "studentNo" | "class" | "locker" | "openType" | "verify" | "admin" | "remark";

export function HistoryTable() {
  const t = useTranslations();
  const search = useSearchParams();
  const studentNo = search.get("studentNo");
  const lockerCode = search.get("lockerCode");
  const [rows, setRows] = useState<Row[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("openedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const visible = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const value = (row: Row) => {
        switch (sortKey) {
          case "openedAt":
            return row.openedAt;
          case "studentName":
            return row.studentName ?? "";
          case "studentNo":
            return row.studentNo;
          case "class":
            return row.classCode;
          case "locker":
            return row.lockerCode;
          case "openType":
            return row.openType;
          case "verify":
            return row.verifyMethod;
          case "admin":
            return row.adminName;
          case "remark":
            return row.remark;
          default:
            return "";
        }
      };
      return String(value(a)).localeCompare(String(value(b)), "en") * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function head(key: SortKey, label: string) {
    return (
      <th>
        <button type="button" className="sort" onClick={() => toggleSort(key)}>
          {label}
          {sortMark(key)}
        </button>
      </th>
    );
  }

  function downloadVisible() {
    const headers = [
      t("openedAt"),
      t("studentName"),
      t("studentNo"),
      t("class"),
      t("lastLocker"),
      t("openType"),
      t("verify"),
      t("admin"),
      t("remark"),
    ];
    const data = visible.map((row) => [
      row.openedAt,
      row.studentName ?? "",
      row.studentNo,
      row.classCode,
      row.lockerCode,
      row.openType,
      row.verifyMethod,
      row.adminName,
      row.remark,
    ]);
    downloadCsv(`history-${formatHkDate(new Date())}.csv`, toCsv(headers, data));
  }

  return (
    <section className="card">
      <p>
        <Link href="/">{t("back")}</Link>
      </p>
      <div className="table-heading">
        <h1>{t("history")}</h1>
        <button type="button" className="secondary" disabled={visible.length === 0} onClick={downloadVisible}>
          {t("downloadCsv")}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            {head("openedAt", t("openedAt"))}
            {head("studentName", t("studentName"))}
            {head("studentNo", t("studentNo"))}
            {head("class", t("class"))}
            {head("locker", t("lastLocker"))}
            {head("openType", t("openType"))}
            {head("verify", t("verify"))}
            {head("admin", t("admin"))}
            {head("remark", t("remark"))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={9}>{t("noRows")}</td>
            </tr>
          ) : (
            visible.map((row) => (
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
