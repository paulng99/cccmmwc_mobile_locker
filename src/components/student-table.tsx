"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { compareSchoolPlace, doorTone, hkToday, parseSchoolPlace } from "@/lib/open-log";

type Row = {
  studentNo: string;
  classCode: string;
  studentName: string | null;
  lastLockerCode: string;
  lastOpenedAt: string | null;
};

type Placed = Row & ReturnType<typeof parseSchoolPlace>;

export function StudentTable() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [form, setForm] = useState("all");
  const [klass, setKlass] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const today = hkToday();

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
    return rows
      .map((row) => ({ ...row, ...parseSchoolPlace(row.studentNo, row.classCode) }))
      .sort((a, b) => compareSchoolPlace(a, b) || a.studentNo.localeCompare(b.studentNo));
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

  const visible = placed.filter((row) => {
    if (form !== "all" && row.form !== form) return false;
    if (klass !== "all" && row.classGroup !== klass) return false;
    return true;
  });

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
                  <th>{t("form")}</th>
                  <th>{t("class")}</th>
                  <th>{t("studentNo")}</th>
                  <th>{t("studentName")}</th>
                  <th>{t("lastLocker")}</th>
                  <th>{t("lastUsed")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.studentNo}
                    className={
                      !row.lastOpenedAt || !row.lastLockerCode
                        ? "vacant"
                        : doorTone(row.lastOpenedAt, today)
                    }
                  >
                    <td>{row.form ? t("formGrade", { id: row.form }) : "—"}</td>
                    <td>{row.classGroup || row.classCode || "—"}</td>
                    <td>{row.classNo ? String(row.classNo).padStart(2, "0") : row.studentNo}</td>
                    <td>{row.studentName ?? ""}</td>
                    <td>{row.lastLockerCode || t("vacant")}</td>
                    <td>{row.lastOpenedAt ?? t("vacant")}</td>
                    <td>
                      <Link className="history" href={`/history?studentNo=${encodeURIComponent(row.studentNo)}`}>
                        {t("history")}
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
