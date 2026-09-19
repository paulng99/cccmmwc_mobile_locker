"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { HistoryIcon, YesIcon } from "@/components/icons";
import { compareSchoolPlace, parseSchoolPlace, studentRowTone } from "@/lib/open-log";

type Row = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lastLockerCode: string;
  lastOpenedAt: string | null;
  unused: boolean;
  todayOpenCount: number;
};

type Placed = Row & ReturnType<typeof parseSchoolPlace>;
type SortKey = "form" | "class" | "studentNo" | "studentName" | "lastLocker" | "lastUsed" | "unused" | "todayOnce";

export function StudentTable() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [form, setForm] = useState("all");
  const [klass, setKlass] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("studentNo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/students?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as { rows: Row[] };
      setRows(data.rows ?? []);
      setForm("all");
      setKlass("all");
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  const placed = useMemo<Placed[]>(() => {
    return rows.map((row) => ({ ...row, ...parseSchoolPlace(row.studentNo, row.classCode) }));
  }, [rows]);

  const forms = useMemo(() => {
    const set = new Set(placed.map((row) => row.form).filter(Boolean));
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [placed]);

  const classes = useMemo(() => {
    const source = form === "all" ? placed : placed.filter((row) => row.form === form);
    const set = new Set(source.map((row) => row.classGroup).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [placed, form]);

  const visible = useMemo(() => {
    const filtered = placed.filter((row) => {
      if (form !== "all" && row.form !== form) return false;
      if (klass !== "all" && row.classGroup !== klass) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const bySchool = compareSchoolPlace(a, b);
      const value = (row: Placed) => {
        switch (sortKey) {
          case "form":
            return Number(row.form || 99);
          case "class":
            return row.classGroup || row.classCode;
          case "studentNo":
            return row.classNo || row.studentNo;
          case "studentName":
            return row.studentName ?? "";
          case "lastLocker":
            return row.lastLockerCode;
          case "lastUsed":
            return row.lastOpenedAt ?? "";
          case "unused":
            return row.unused ? 1 : 0;
          case "todayOnce":
            return row.todayOpenCount;
          default:
            return 0;
        }
      };
      const left = value(a);
      const right = value(b);
      if (typeof left === "number" && typeof right === "number" && left !== right) {
        return (left - right) * dir;
      }
      const text = String(left).localeCompare(String(right), "en");
      if (text !== 0) return text * dir;
      return bySchool;
    });
  }, [placed, form, klass, sortKey, sortDir]);

  const groups = useMemo(() => {
    const map = new Map<string, Placed[]>();
    for (const row of visible) {
      const key = row.classGroup || t("otherGroup");
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visible, t]);

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

  return (
    <section className="card">
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
      <div className="filters">
        <button type="button" className={form === "all" ? "active" : ""} onClick={() => { setForm("all"); setKlass("all"); }}>
          {t("allForms")}
        </button>
        {forms.map((id) => (
          <button
            key={id}
            type="button"
            className={form === id ? "active" : ""}
            onClick={() => { setForm(id); setKlass("all"); }}
          >
            {t("formGrade", { id })}
          </button>
        ))}
      </div>
      <div className="filters">
        <button type="button" className={klass === "all" ? "active" : ""} onClick={() => setKlass("all")}>
          {t("allClasses")}
        </button>
        {classes.map((id) => (
          <button
            key={id}
            type="button"
            className={klass === id ? "active" : ""}
            onClick={() => {
              setKlass(id);
              const parsed = parseSchoolPlace(`${id}01`, id);
              if (parsed.form) setForm(parsed.form);
            }}
          >
            {t("classGroup", { id })}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="hint">{t("noRows")}</p>
      ) : (
        groups.map(([group, list]) => (
          <div key={group} className="student-group">
            <h2>
              {list[0].form ? `${t("formGrade", { id: list[0].form })} · ${t("classGroup", { id: group })}` : t("otherGroup")}
              <span>{list.length}</span>
            </h2>
            <table className="table">
              <thead>
                <tr>
                  {head("form", t("form"))}
                  {head("class", t("class"))}
                  {head("studentNo", t("studentNo"))}
                  {head("studentName", t("studentName"))}
                  {head("lastLocker", t("lastLocker"))}
                  {head("lastUsed", t("lastUsed"))}
                  {head("unused", t("unused"))}
                  {head("todayOnce", t("todayOnce"))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.studentNo}
                    className={studentRowTone({ unused: row.unused, todayOpenCount: row.todayOpenCount })}
                  >
                    <td>{row.form ? t("formGrade", { id: row.form }) : "—"}</td>
                    <td>{row.classGroup || row.classCode || "—"}</td>
                    <td>{row.classNo ? String(row.classNo).padStart(2, "0") : row.studentNo}</td>
                    <td>{row.studentName ?? ""}</td>
                    <td>{row.lastLockerCode || t("vacant")}</td>
                    <td>{row.lastOpenedAt ?? t("vacant")}</td>
                    <td className="mark">{row.unused ? <YesIcon label={t("yes")} /> : ""}</td>
                    <td className="mark">{row.todayOpenCount === 1 ? <YesIcon label={t("yes")} /> : ""}</td>
                    <td className="mark">
                      <Link
                        className="history"
                        href={`/history?studentNo=${encodeURIComponent(row.studentNo)}`}
                        aria-label={t("history")}
                        title={t("history")}
                      >
                        <HistoryIcon />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
