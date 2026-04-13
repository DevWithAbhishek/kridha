// src/app/(admin)/layout.tsx
// Server component — checks kridha_admin cookie before rendering.
// Redirects to /admin/login if cookie absent.
// Does NOT verify JWT signature here — middleware does that for API routes.
// This just prevents the flash of admin UI before the first API call.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const token = store.get('kridha_admin')?.value;

  // Cookie absent = definitely not logged in. Redirect before any HTML.
  // Middleware will re-verify the JWT on every /api/admin/* call.
  if (!token) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      {children}
    </div>
  );
}
