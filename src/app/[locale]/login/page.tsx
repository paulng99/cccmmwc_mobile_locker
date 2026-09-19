import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/routing";
import { LoginForm } from "@/components/login-form";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (session.userId) redirect({ href: "/", locale });
  return (
    <Shell>
      <LoginForm />
    </Shell>
  );
}
