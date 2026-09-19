import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  loginName?: string;
};

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET ?? "build-placeholder-secret-32-chars!!";
  if (password.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return {
    password,
    cookieName: "locker_session",
    cookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return session;
}
