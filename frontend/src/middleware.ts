import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // حذف کوکی‌های غیرضروری
  // لیست کوکی‌های غیرضروری که باید حذف شوند
  const cookiesToRemove = [
    "__next_hmr_refresh_hash__", // HMR refresh hash (فقط development)
    "phpmyadmin",
    "pma",
    "land",
    "refresh_token",
    // فقط "token" نگه داشته می‌شود (اگر نیاز دارید)
  ];

  // حذف کوکی‌ها از response
  cookiesToRemove.forEach((cookieName) => {
    response.cookies.delete(cookieName);
    // همچنین از request هم حذف می‌کنیم
    if (request.cookies.has(cookieName)) {
      response.cookies.delete(cookieName);
    }
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

