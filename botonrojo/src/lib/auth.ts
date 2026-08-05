import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./passwords";

export { hashPassword, verifyPassword };

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: "superadmin" | "admin" | "affiliate" | "customer";
      isSuperAdmin: boolean;
      affiliateCode?: string | null;
      organizationId?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Required behind the reverse proxy: in production Auth.js refuses any request
  // whose Host it wasn't told to expect, and every request arrives from Caddy. The
  // symptom is nasty because it doesn't look like an auth problem — the session
  // silently reads as absent and every admin page bounces to /login forever.
  //
  // Safe here because Caddy is the only thing that can reach the app: it sets Host
  // and X-Forwarded-* itself, and the app's port is bound to localhost.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        try {
          const email = String(creds?.email ?? "").toLowerCase().trim();
          const password = String(creds?.password ?? "");
          if (!email || !password) {
            console.warn("[auth] empty credentials");
            return null;
          }
          const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (!user) {
            console.warn(`[auth] user not found: ${email}`);
            return null;
          }
          if (!user.passwordHash) {
            console.warn(`[auth] user has no passwordHash: ${email} — run pnpm db:seed`);
            return null;
          }
          const ok = await verifyPassword(password, user.passwordHash);
          if (!ok) {
            console.warn(`[auth] wrong password for: ${email}`);
            return null;
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            affiliateCode: user.affiliateCode,
            organizationId: user.organizationId,
          };
        } catch (err) {
          console.error("[auth] authorize threw:", err);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.isSuperAdmin = (user as { isSuperAdmin: boolean }).isSuperAdmin;
        token.affiliateCode = (user as { affiliateCode?: string | null }).affiliateCode;
        token.organizationId = (user as { organizationId?: string | null }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "superadmin" | "admin" | "affiliate" | "customer";
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.affiliateCode = (token.affiliateCode as string | null | undefined) ?? null;
        session.user.organizationId = (token.organizationId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
