"use client";

import type { AdminUser } from "@/lib/auth";

interface AdminSessionResponse {
  authenticated: boolean;
  user?: AdminUser;
}

export async function fetchAdminSession(): Promise<AdminSessionResponse> {
  const response = await fetch("/api/admin/login", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return { authenticated: false };
  }

  const data = await response.json();
  return {
    authenticated: Boolean(data.authenticated),
    user: data.user,
  };
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/admin/login", {
    method: "DELETE",
    credentials: "include",
  });
}
