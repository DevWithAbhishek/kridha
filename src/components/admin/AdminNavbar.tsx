// src/components/admin/AdminNavbar.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import type { AdminUser } from '@/types/admin';

interface Props { admin: AdminUser }

const NAV = [
  { href: '/admin/sellers',          label: 'Sellers',   badge: 'queue' },
  { href: '/admin/sellers?status=PENDING', label: 'Pending',  badge: 'pending' },
  { href: '/admin/audit',            label: 'Audit Log', badge: null },
  { href: '/admin/admins',           label: 'Admins',    badge: null, superAdminOnly: true },
];

export function AdminNavbar({ admin }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await adminApi.post('/auth/logout').catch(() => {});
    router.replace('/admin/login');
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/admin/sellers" className="flex items-center gap-2.5">
            <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-white text-sm">Admin</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(item => {
              if (item.superAdminOnly && admin.role !== 'SUPER_ADMIN') return null;
              const active = pathname === item.href || pathname.startsWith(item.href.split('?')[0] + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-kridha-primary/20 text-kridha-primary'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: admin name + role + logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{admin.name}</p>
            <p className="text-xs text-gray-500">{admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Reviewer'}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  );
}
