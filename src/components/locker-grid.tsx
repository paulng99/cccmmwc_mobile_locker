"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { CABINETS } from "@/lib/open-log";

type Door = {
  lockerCode: string;
  doorNo: string;
  vacant: boolean;
  studentName: string | null;
  studentNo: string | null;
  classCode: string | null;
  lastOpenedAt: string | null;
};

export function LockerGrid() {
  const t = useTranslations();
  const [cabinet, setCabinet] = useState("A");
  const [hideVacant, setHideVacant] = useState(false);
  const [doors, setDoors] = useState<Door[]>([]);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/lockers?cabinet=${cabinet}`);
      const data = (await response.json()) as { doors: Door[] };
      setDoors(data.doors ?? []);
    })();
  }, [cabinet]);

  const visible = hideVacant ? doors.filter((door) => !door.vacant) : doors;

  return (
    <section className="card">
      <div className="cabinets">
        {CABINETS.map((id) => (
          <button key={id} className={`c${id}`} type="button" onClick={() => setCabinet(id)}>
            {t("cabinet", { id })}
          </button>
        ))}
      </div>
      <button type="button" className="primary" onClick={() => setHideVacant((value) => !value)}>
        {hideVacant ? t("showVacant") : t("hideVacant")}
      </button>
      <div className="grid" style={{ marginTop: 16 }}>
        {visible.map((door) => (
          <article key={door.lockerCode} className={`door ${door.vacant ? "vacant" : ""}`}>
            <div className="no">{door.doorNo}</div>
            {door.vacant ? (
              <div>{t("vacant")}</div>
            ) : (
              <>
                {door.studentName ? <div>{door.studentName}</div> : null}
                <div>
                  {door.classCode} {door.studentNo}
                </div>
                <div>{door.lastOpenedAt}</div>
              </>
            )}
            <Link className="history" href={`/history?lockerCode=${encodeURIComponent(door.lockerCode)}`}>
              {t("history")}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
