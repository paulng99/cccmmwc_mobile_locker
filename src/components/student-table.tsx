"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { CrossIcon, HistoryIcon, YesIcon } from "@/components/icons";
import { downloadCsv, toCsv } from "@/lib/csv";
import { compareSchoolPlace, formatHkDate, groupByFormAndClass, matchesStudentUsageFilter, parseSchoolPlace, studentRowTone } from "@/lib/open-log";

type Row = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lastLockerCode: string;
  assignedLockerCode: string;
  lastOpenedAt: string | null;
  unused: boolean;
  todayOpenCount: number;
};

type Placed = Row & ReturnType<typeof parseSchoolPlace>;
type SortKey = "form" | "class" | "studentNo" | "studentName" | "assignedLocker" | "lastLocker" | "lastUsed" | "unused" | "todayOnce";

export function StudentTable() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [form, setForm] = useState("all");
  const [klass, setKlass] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("studentNo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [noUseToday, setNoUseToday] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
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
      return matchesStudentUsageFilter(row, { noUseToday, openedOnce });
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
          case "assignedLocker":
            return row.assignedLockerCode;
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
  }, [placed, form, klass, sortKey, sortDir, noUseToday, openedOnce]);

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

  const formGroups = useMemo(() => (noUseToday ? groupByFormAndClass(visible) : []), [noUseToday, visible]);

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

  function downloadVisible() {
    const headers = [
      t("form"),
      t("class"),
      t("studentNo"),
      t("studentName"),
      t("assignedLocker"),
      t("lastLocker"),
      t("lastUsed"),
      t("unused"),
      t("todayOnce"),
    ];
    const data = visible.map((row) => [
      row.form ? t("formGrade", { id: row.form }) : "",
      row.classGroup || row.classCode || "",
      row.classNo ? String(row.classNo).padStart(2, "0") : row.studentNo,
      row.studentName ?? "",
      row.assignedLockerCode || t("vacant"),
      row.lastLockerCode || t("vacant"),
      row.lastOpenedAt ?? "",
      row.unused ? t("yes") : "",
      row.todayOpenCount === 1 ? t("yes") : "",
    ]);
    downloadCsv(`students-${formatHkDate(new Date())}.csv`, toCsv(headers, data));
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

  function studentTable(list: Placed[]) {
    return (
      <table className="table">
        <thead>
          <tr>
            {head("form", t("form"))}
            {head("class", t("class"))}
            {head("studentNo", t("studentNo"))}
            {head("studentName", t("studentName"))}
            {head("assignedLocker", t("assignedLocker"))}
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
              <td>{row.assignedLockerCode || t("vacant")}</td>
              <td>{row.lastLockerCode || t("vacant")}</td>
              <td>{row.lastOpenedAt ?? t("vacant")}</td>
              <td className="mark">{row.unused ? <CrossIcon label={t("unused")} /> : ""}</td>
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
    );
  }

  const empty = noUseToday ? formGroups.length === 0 : groups.length === 0;

  return (
    <section className="card">
      <div className="student-toolbar">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} />
        <select
          aria-label={t("form")}
          value={form}
          onChange={(e) => {
            setForm(e.target.value);
            setKlass("all");
          }}
        >
          <option value="all">{t("allForms")}</option>
          {forms.map((id) => (
            <option key={id} value={id}>
              {t("formGrade", { id })}
            </option>
          ))}
        </select>
        <select
          aria-label={t("class")}
          value={klass}
          onChange={(e) => {
            const id = e.target.value;
            setKlass(id);
            if (id === "all") return;
            const parsed = parseSchoolPlace(`${id}01`, id);
            if (parsed.form) setForm(parsed.form);
          }}
        >
          <option value="all">{t("allClasses")}</option>
          {classes.map((id) => (
            <option key={id} value={id}>
              {t("classGroup", { id })}
            </option>
          ))}
        </select>
      </div>
      <div className="usage-filters">
        <label className={noUseToday ? "active" : ""}>
          <input
            type="checkbox"
            checked={noUseToday}
            onChange={(e) => setNoUseToday(e.target.checked)}
          />
          {t("noUseToday")}
        </label>
        <label className={openedOnce ? "active" : ""}>
          <input
            type="checkbox"
            checked={openedOnce}
            onChange={(e) => setOpenedOnce(e.target.checked)}
          />
          {t("openedOnceToday")}
        </label>
      </div>
      <div className="table-actions">
        <button type="button" className="secondary" disabled={visible.length === 0} onClick={downloadVisible}>
          {t("downloadCsv")}
        </button>
      </div>
      {empty ? (
        <p className="hint">{t("noRows")}</p>
      ) : noUseToday ? (
        formGroups.map((formGroup) => (
          <section key={formGroup.form || "other"} className="form-section">
            <h2>
              {formGroup.form ? t("formGrade", { id: formGroup.form }) : t("otherGroup")}
              <span>{formGroup.classes.reduce((count, item) => count + item.rows.length, 0)}</span>
            </h2>
            {formGroup.classes.map((classGroup) => (
              <div key={classGroup.classGroup || "other"} className="student-group">
                <h3>
                  {classGroup.classGroup ? t("classGroup", { id: classGroup.classGroup }) : t("otherGroup")}
                  <span>{classGroup.rows.length}</span>
                </h3>
                {studentTable(classGroup.rows)}
              </div>
            ))}
          </section>
        ))
      ) : (
        groups.map(([group, list]) => (
          <div key={group} className="student-group">
            <h2>
              {list[0].form ? `${t("formGrade", { id: list[0].form })} · ${t("classGroup", { id: group })}` : t("otherGroup")}
              <span>{list.length}</span>
            </h2>
            {studentTable(list)}
          </div>
        ))
      )}
    </section>
  );
}
