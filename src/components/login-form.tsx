"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const [loginName, setLoginName] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginName, password }),
    });
    if (!response.ok) {
      setError(true);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="card login" onSubmit={onSubmit}>
      <h1>{t("login")}</h1>
      {error ? <p className="alert">{t("loginError")}</p> : null}
      <label className="field">
        {t("loginName")}
        <input value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="username" />
      </label>
      <label className="field">
        {t("password")}
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      <button className="primary" type="submit">
        {t("signIn")}
      </button>
    </form>
  );
}
