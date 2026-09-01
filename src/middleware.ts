import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const APP_ROUTE_PREFIXES = ["/my-day", "/calendar", "/flow-board", "/deep-work", "/stats", "/settings", "/workspace"];

export default auth((req) => {
  const isAppRoute = APP_ROUTE_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isAppRoute && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/my-day/:path*",
    "/calendar/:path*",
    "/flow-board/:path*",
    "/deep-work/:path*",
    "/stats/:path*",
    "/settings/:path*",
    "/workspace/:path*",
  ],
};
