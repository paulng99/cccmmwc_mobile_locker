import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/routing";
import { Shell } from "@/components/shell";
import { UpdateBar } from "@/components/update-bar";
import { StudentTable } from "@/components/student-table";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session.userId) redirect({ href: "/login", locale });
  return (
    <Shell loginName={session.loginName}>
      <UpdateBar />
      <StudentTable />
    </Shell>
  );
}
