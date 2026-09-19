import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/shell";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session.userId) redirect({ href: "/login", locale });
  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return (
    <Shell loginName={session.loginName}>
      <SettingsForm
        initial={{
          intranetBaseUrl: settings.intranetBaseUrl,
          sessionStorageKey: settings.sessionStorageKey,
          sessionPayload: settings.sessionPayload,
          exportApiPath: settings.exportApiPath,
          firstImportDate: settings.firstImportDate,
          doorsPerCabinet: settings.doorsPerCabinet,
        }}
      />
    </Shell>
  );
}
