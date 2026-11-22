import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import type { Language } from '../data/whiteGardenData';
import type { BranchId } from '../utils/waitlistLogic';

export interface StaffAuthSession {
  token: string;
  username: string;
  branchId: BranchId | 'all';
  branchName: string;
  role: 'branch_staff' | 'admin';
}

interface StaffLoginViewProps {
  lang: Language;
  onLoginSuccess: (session: StaffAuthSession) => void;
}

export function StaffLoginView({ lang, onLoginSuccess }: StaffLoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAr = lang === 'ar';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError(
        isAr
          ? 'يرجى إدخال اسم الفرع وكلمة المرور.'
          : 'Please enter both branch login ID and password.',
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          isAr
            ? 'بيانات الدخول غير صحيحة. تأكد من اسم الفرع وكلمة المرور.'
            : data.error || 'Invalid branch login ID or password.',
        );
        return;
      }

      const session: StaffAuthSession = {
        token: data.token,
        username: data.user.username,
        branchId: data.user.branchId,
        branchName: data.user.branchName,
        role: data.user.role,
      };
      onLoginSuccess(session);
    } catch {
      setError(
        isAr
          ? 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.'
          : 'Unable to reach server. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="bg-white border border-[#1B4332]/15 rounded-3xl shadow-sm overflow-hidden">
        {/* Top Brand Banner */}
        <div className="bg-[#081C15] text-white px-6 py-7 text-center border-b border-[#C5A059]/40 space-y-3">
          <div className="flex justify-center">
            <img
              src="/white-garden-logo.svg"
              alt="White Garden — وايت قاردن"
              className="h-12 w-auto rounded-lg shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              {isAr ? 'تسجيل دخول موظفي الفرع' : 'Branch Staff Login'}
            </h1>
            <p className="text-xs sm:text-sm text-[#95D5B2]/90">
              {isAr
                ? 'أدخل بيانات الفرع لإدارة قائمة الانتظار والطاولات'
                : 'Sign in with your branch credentials to access the Hostess Desk'}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="staff-username"
              className="block text-xs sm:text-sm font-semibold text-[#081C15]"
            >
              {isAr ? 'اسم الفرع (معرف الدخول)' : 'Branch Login ID'}
            </label>
            <div className="relative">
              <User
                className="w-4 h-4 text-[#1B4332]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="staff-username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                dir="ltr"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus:border-[#1B4332]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staff-password"
              className="block text-xs sm:text-sm font-semibold text-[#081C15]"
            >
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-[#1B4332]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="staff-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                dir="ltr"
                className="w-full ps-10 pe-11 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus:border-[#1B4332]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-[#1B4332]/60 hover:text-[#081C15] p-1 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#081C15] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            <span>
              {loading
                ? isAr
                  ? 'جاري التحقق...'
                  : 'Signing in...'
                : isAr
                  ? 'تسجيل الدخول لمكتب الاستقبال'
                  : 'Sign In to Hostess Desk'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
