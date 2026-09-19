"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { CABINETS, doorTone, hkToday } from "@/lib/open-log";

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
  const [doors, setDoors] = useState<Door[]>([]);
  const today = hkToday();

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/lockers?cabinet=${cabinet}`);
      const data = (await response.json()) as { doors: Door[] };
      setDoors(data.doors ?? []);
    })();
  }, [cabinet]);

  return (
    <section className="card locker-board">
      <div className="cabinets">
        {CABINETS.map((id) => (
          <button
            key={id}
            className={`c${id}${cabinet === id ? " active" : ""}`}
            type="button"
            onClick={() => setCabinet(id)}
          >
            {t("cabinet", { id })}
          </button>
        ))}
      </div>
      <div className="locker-grid">
        {doors.map((door) => {
          const tone = doorTone(door.lastOpenedAt, today);
          return (
            <article key={door.lockerCode} className={`door ${tone}`}>
              <div className="no">{door.doorNo}</div>
              {tone === "vacant" ? (
                <div className="door-meta">{t("vacant")}</div>
              ) : (
                <>
                  {door.studentName ? <div className="door-name">{door.studentName}</div> : null}
                  <div className="door-meta">
                    {door.classCode} {door.studentNo}
                  </div>
                  <div className="door-meta">{door.lastOpenedAt}</div>
                </>
              )}
              <Link className="history" href={`/history?lockerCode=${encodeURIComponent(door.lockerCode)}`}>
                {t("history")}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
