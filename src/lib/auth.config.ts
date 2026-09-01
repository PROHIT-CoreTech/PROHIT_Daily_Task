import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the NextAuth config — no providers here, since
// Credentials.authorize() pulls in Mongoose (Node-only APIs) and bcryptjs,
// neither of which can bundle into the Edge middleware runtime. Middleware
// only needs to read the session JWT, not run provider logic.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
};
