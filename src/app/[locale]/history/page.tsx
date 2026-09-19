import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/routing";
import { Shell } from "@/components/shell";
import { HistoryTable } from "@/components/history-table";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session.userId) redirect({ href: "/login", locale });
  return (
    <Shell loginName={session.loginName}>
      <Suspense>
        <HistoryTable />
      </Suspense>
    </Shell>
  );
}
