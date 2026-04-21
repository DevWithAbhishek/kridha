// src/app/admin/login/page.tsx
// Admin login — separate from buyer/seller login.
// No language toggle (admin is English-only — internal tool).
// Email + password (not phone + PIN).
// Rate limited to 2/min on the backend.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { adminApi } from '@/lib/adminApi';
import type { AdminUser } from '@/types/admin';

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);

    try {
      await adminApi.post<{ success: true; data: { admin: AdminUser } }>(
        '/auth/login',
        { email, password },
      );
      router.replace('/admin/sellers');
    } catch (err) {
      const e = err as { response?: { data?: { code?: string } } };
      const code = e.response?.data?.code;
      if (code === 'RATE_LIMITED') {
        setError('Too many attempts. Wait 1 minute.');
      } else {
        // ADMIN_INVALID_CREDENTIALS — same message for wrong email or wrong password
        setError('Invalid email or password: ');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/kridha_logo_nav.png"
              alt="Kridha"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Kridha Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Platform operations panel</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }} className="flex flex-col gap-5">

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@kridha.in"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={12}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-kridha-primary text-white font-semibold py-3 rounded-xl hover:bg-kridha-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          This panel is for platform administrators only.
        </p>
      </div>
    </div>
  );
}
