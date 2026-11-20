/**
 * Haros HRMIS - Government-Grade Civil Service Sign-In & Activation Portal
 * Enforces first-time computer registration, administrator-gated configuration,
 * Trade EDate expiry control, and local clock-tampering protection.
 */

import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  ShieldCheck,
  Monitor,
  Calendar,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { db } from '../../db/storage';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';
import { StartupValidationResult } from '../../types';
import { ActivationAdminAuthModal } from './ActivationAdminAuthModal';
import { AdministrativeConfigPanel } from './AdministrativeConfigPanel';
import { ExpiryBlockedModal } from './ExpiryBlockedModal';
import harosHrmisBanner from '../../assets/images/haros_hrmis_banner_1794744303519.jpg';

interface LoginPageProps {
  startupStatus: StartupValidationResult;
  onRefreshValidation: () => StartupValidationResult;
}

export const LoginPage: React.FC<LoginPageProps> = ({ startupStatus, onRefreshValidation }) => {
  const { login } = useAuth();
  const notifications = useNotifications();
  const { institutionName, institutionCountry } = useInstitutionInfo();
  const [bannerFailed, setBannerFailed] = useState(false);

  // Portal Tabs: LOGIN PAGE vs ADMINISTRATIVE CONFIG
  const [activeTab, setActiveTab] = useState<'login' | 'admin_config'>('login');
  const [authorizedAdmin, setAuthorizedAdmin] = useState<string | null>(null);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);

  // Sign-In Form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotNote, setShowForgotNote] = useState(false);

  const handleOpenAdminConfig = () => {
    if (authorizedAdmin) {
      setActiveTab('admin_config');
    } else {
      setShowAdminAuthModal(true);
    }
  };

  const handleSelectLoginTab = () => {
    // Auto-lock admin config when switching back to Login Page so ordinary users cannot bypass
    setAuthorizedAdmin(null);
    setActiveTab('login');
    onRefreshValidation();
  };

  const handleAdminAuthorized = (adminUsername: string) => {
    setAuthorizedAdmin(adminUsername);
    setShowAdminAuthModal(false);
    setActiveTab('admin_config');
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password) {
      const msg = 'Please enter both your username (or email) and password.';
      setErrorMsg(msg);
      notifications.warning('Credentials Required', msg, { module: 'Security & Auth' });
      return;
    }

    // Check if the activation administrator credentials (e.g. Harry) were entered on the Login Page
    const adminAuth = db.authenticateActivationAdmin(identifier.trim(), password, {
      silentFailure: true,
    });
    if (adminAuth.success && adminAuth.admin) {
      setIdentifier('');
      setPassword('');
      setShowPassword(false);
      setErrorMsg(null);
      notifications.success(
        'Administrator Authorized',
        `Administrative Configuration unlocked for ${adminAuth.admin.username}.`,
        { module: 'Computer Registration', actor: adminAuth.admin.username }
      );
      setAuthorizedAdmin(adminAuth.admin.username);
      setActiveTab('admin_config');
      return;
    }

    const latestStatus = onRefreshValidation();
    if (!latestStatus.canAccessLogin) {
      setErrorMsg(
        latestStatus.blockReason === 'UNREGISTERED_COMPUTER'
          ? 'This workstation is not registered. Administrator activation is required.'
          : latestStatus.blockReason === 'CLOCK_TAMPERED'
          ? 'System clock or license integrity verification failed. Contact administrator.'
          : latestStatus.blockReason === 'EXPIRY_NOT_CONFIGURED'
          ? 'Application expiry period (Trade EDate) has not been configured by the administrator.'
          : 'Your HRMIS access authorization has expired. Please contact the administrator for renewal.'
      );
      return;
    }

    const res = login(identifier.trim(), password);
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials.');
    }
  };

  // Once the workstation is registered, hide the top portal switcher & license banner on the Login screen
  // unless Administrative Config is explicitly unlocked & active.
  const showPortalHeaderBar =
    !startupStatus.isComputerRegistered ||
    (activeTab === 'admin_config' && Boolean(authorizedAdmin));

  const shouldShowExpiryPopup =
    activeTab === 'login' &&
    !showAdminAuthModal &&
    startupStatus.isComputerRegistered &&
    (startupStatus.blockReason === 'EXPIRED' || startupStatus.blockReason === 'CLOCK_TAMPERED');

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden flex flex-col antialiased"
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        color: '#0F1F1A',
      }}
    >
      {/* Soft Atmospheric Background Image (Blurred) + Ambient Emerald & Gold Color Fields */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#d8eae1]">
        {!bannerFailed && (
          <img
            src={harosHrmisBanner}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              filter: 'blur(20px) saturate(1.2)',
              opacity: 0.5,
              transform: 'scale(1.08)',
            }}
          />
        )}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 78% 28%, rgba(0, 107, 63, 0.24) 0%, rgba(0, 107, 63, 0.04) 42%, transparent 65%), radial-gradient(circle at 65% 78%, rgba(201, 162, 77, 0.28) 0%, rgba(201, 162, 77, 0.04) 40%, transparent 62%), radial-gradient(circle at 18% 82%, rgba(0, 107, 63, 0.16) 0%, transparent 50%), linear-gradient(135deg, rgba(235, 245, 240, 0.72), rgba(248, 251, 249, 0.58))',
          }}
        />
      </div>

      {/* Top Portal Navigation Bar: shown before first-time registration or while Admin Config is unlocked */}
      {showPortalHeaderBar && (
        <header className="relative z-20 w-full border-b border-white/60 bg-white/65 backdrop-blur-md">
          <div className="max-w-[1160px] mx-auto px-6 sm:px-10 lg:px-12 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectLoginTab}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-[#006B3F] text-white shadow-xs'
                    : 'text-[#0F1F1A] hover:bg-white/80 border border-transparent hover:border-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>LOGIN PAGE</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAdminConfig}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                  activeTab === 'admin_config'
                    ? 'bg-[#0F1F1A] text-[#edd6a8] shadow-xs border border-[#C9A24D]/50'
                    : 'text-[#0F1F1A] hover:bg-white/80 border border-slate-300/80 bg-white/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ADMINISTRATIVE CONFIG</span>
              </button>
            </div>

            {/* Subtle Workstation Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium">
              <span className="font-mono text-slate-600">{startupStatus.detectedComputerName}</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  startupStatus.canAccessLogin
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : startupStatus.blockReason === 'UNREGISTERED_COMPUTER'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {startupStatus.canAccessLogin
                  ? `Licensed (${startupStatus.tradeEDate})`
                  : startupStatus.blockReason === 'UNREGISTERED_COMPUTER'
                  ? 'Unregistered Workstation'
                  : startupStatus.blockReason === 'EXPIRY_NOT_CONFIGURED'
                  ? 'Trade EDate Required'
                  : startupStatus.blockReason === 'CLOCK_TAMPERED'
                  ? 'Security Lock'
                  : 'Authorization Expired'}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center">
        {activeTab === 'admin_config' && authorizedAdmin ? (
          <div className="w-full max-w-[1160px] mx-auto px-6 sm:px-10 lg:px-12 py-8">
            <AdministrativeConfigPanel
              authorizedAdminUsername={authorizedAdmin}
              startupStatus={startupStatus}
              onValidationChanged={onRefreshValidation}
              onLockAndReturn={handleSelectLoginTab}
            />
          </div>
        ) : (
          /* LOGIN PAGE TAB: Two-Column Grid (Card-First on Mobile) */
          <div className="w-full max-w-[1160px] mx-auto px-6 sm:px-10 lg:px-12 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left Branding Block */}
            <div className="order-2 lg:order-1 lg:col-span-6 space-y-6">
              <div className="flex items-center gap-3.5">
                <div
                  className="rounded-full bg-white/80"
                  style={{ border: '1px solid rgba(201, 162, 77, 0.5)' }}
                >
                  <BrandCrest
                    sizeClass="w-11 h-11"
                    alt="Republic of Ghana Civil Service Emblem"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-wide" style={{ color: '#0F1F1A' }}>
                    {institutionCountry}
                  </div>
                  <div className="text-xs font-medium" style={{ color: '#4A5A55' }}>
                    {institutionName} · Haros HRMIS
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-w-lg">
                <h1
                  className="font-bold tracking-tight leading-[1.14]"
                  style={{
                    color: '#0F1F1A',
                    fontSize: 'clamp(2rem, 3.4vw, 3rem)',
                    textWrap: 'balance',
                  }}
                >
                  Human Resource Management Suite
                </h1>

                <p className="text-base leading-relaxed" style={{ color: '#4A5A55' }}>
                  Secure access for authorized civil service personnel.
                </p>
              </div>
            </div>

            {/* Right Card Column: Either Activation Required Gate OR Standard Login Card */}
            <div className="order-1 lg:order-2 lg:col-span-6 flex justify-center lg:justify-end">
              {!startupStatus.isComputerRegistered ? (
                /* FIRST-TIME REGISTRATION / UNREGISTERED WORKSTATION BLOCK */
                <div
                  className="animate-login-card w-full max-w-[440px] rounded-[20px] p-7 sm:p-9 space-y-5"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%)',
                    backdropFilter: 'blur(14px) saturate(145%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(145%)',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow:
                      '0 16px 48px rgba(0, 60, 40, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 shadow-xs">
                      <Monitor className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-[#0F1F1A]">
                        Computer Registration Required
                      </h2>
                      <p className="text-xs text-[#4A5A55] leading-relaxed">
                        First-time workstation activation is required before accessing the HRMIS
                        login portal. Unregistered computers are restricted.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/90 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Detected Workstation:</span>
                      <span className="font-mono font-bold text-[#0F1F1A]">
                        {startupStatus.detectedComputerName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Hardware ID:</span>
                      <span className="font-mono font-semibold text-[#006B3F]">
                        {startupStatus.hardwareId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Registration Status:</span>
                      <span className="font-bold text-amber-700">Not Registered</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAdminConfig}
                    className="w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105 shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, #edd6a8 0%, #dfc07c 50%, #c9a24d 100%)',
                      color: '#0F1F1A',
                    }}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Authorize &amp; Register Computer</span>
                  </button>
                </div>
              ) : !startupStatus.hasExpiryConfigured ? (
                /* EXPIRY DATE NOT CONFIGURED BLOCK */
                <div
                  className="animate-login-card w-full max-w-[440px] rounded-[20px] p-7 sm:p-9 space-y-5"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%)',
                    backdropFilter: 'blur(14px) saturate(145%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(145%)',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow:
                      '0 16px 48px rgba(0, 60, 40, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[#006B3F] shadow-xs">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-[#0F1F1A]">
                        Authorization Period Required
                      </h2>
                      <p className="text-xs text-[#4A5A55] leading-relaxed">
                        This computer (
                        <strong className="font-mono text-[#0F1F1A]">
                          {startupStatus.detectedComputerName}
                        </strong>
                        ) is registered, but <strong>Trade EDate</strong> has not been configured yet.
                        Administrator authorization is required to set the access expiry date.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAdminConfig}
                    className="w-full h-11 rounded-lg bg-[#006B3F] hover:bg-[#005532] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Configure Trade EDate</span>
                  </button>
                </div>
              ) : startupStatus.isExpired || startupStatus.clockTamperDetected ? (
                /* EXPIRED / CLOCK TAMPER CARD ON BACKGROUND */
                <div
                  className="animate-login-card w-full max-w-[440px] rounded-[20px] p-7 sm:p-9 space-y-5"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 245, 245, 0.78) 100%)',
                    backdropFilter: 'blur(14px) saturate(145%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(145%)',
                    border: '1px solid rgba(225, 29, 72, 0.25)',
                    boxShadow: '0 16px 48px rgba(127, 29, 29, 0.14)',
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-bold text-rose-950">HRMIS Access Suspended</h2>
                    <p className="text-xs text-rose-900 leading-relaxed">
                      Your HRMIS access authorization has expired. Please contact the administrator
                      for renewal.
                    </p>
                    <div className="text-xs font-mono font-bold text-[#006B3F]">
                      Contact: +233243586743 · +233266363781
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAdminConfig}
                    className="w-full h-11 rounded-lg bg-[#006B3F] hover:bg-[#005532] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Administrator Renewal</span>
                  </button>
                </div>
              ) : (
                /* AUTHORIZED NORMAL HRMIS SIGN-IN CARD */
                <div
                  className="animate-login-card w-full max-w-[430px] rounded-[20px] p-7 sm:p-9"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.10) 55%, rgba(255, 255, 255, 0.22) 100%)',
                    backdropFilter: 'blur(14px) saturate(145%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(145%)',
                    border: '1px solid rgba(255, 255, 255, 0.65)',
                    borderRadius: '20px',
                    boxShadow:
                      '0 16px 48px rgba(0, 60, 40, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 0 1px rgba(0, 107, 63, 0.08)',
                  }}
                >
                  {/* Card Header: Logo, Title & Subtitle */}
                  <div className="flex flex-col items-center text-center space-y-3 mb-7">
                    <div
                      className="rounded-full bg-white/80"
                      style={{
                        border: '1.5px solid #C9A24D',
                        boxShadow: '0 4px 16px rgba(0, 60, 40, 0.08)',
                      }}
                    >
                      <BrandCrest
                        sizeClass="w-16 h-16"
                        alt="Ghana Civil Service Official Seal"
                        fallbackIconClassName="w-6 h-6 text-[#006B3F]"
                      />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-lg font-bold tracking-tight" style={{ color: '#0F1F1A' }}>
                        {institutionName}
                      </h2>
                      <p className="text-sm" style={{ color: '#4A5A55' }}>
                        Sign in to access HRMIS
                      </p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="login-identifier"
                        className="block text-xs font-semibold"
                        style={{ color: '#0F1F1A' }}
                      >
                        Email Address or Username
                      </label>
                      <div className="relative">
                        <UserIcon
                          className="w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none"
                          style={{ color: '#4A5A55' }}
                        />
                        <input
                          id="login-identifier"
                          type="text"
                          autoComplete="username"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="e.g. admin or admin@hrmis.gov.gh"
                          className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-white border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006B3F]"
                          style={{ color: '#0F1F1A' }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold"
                        style={{ color: '#0F1F1A' }}
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          className="w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none"
                          style={{ color: '#4A5A55' }}
                        />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full h-11 pl-10 pr-11 rounded-lg bg-white border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006B3F]"
                          style={{ color: '#0F1F1A' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1.5 top-1.5 w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-11 mt-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99] shadow-md"
                      style={{
                        background: 'linear-gradient(135deg, #edd6a8 0%, #dfc07c 50%, #c9a24d 100%)',
                        color: '#0F1F1A',
                      }}
                    >
                      <span>Sign In</span>
                      <LogIn className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotNote(!showForgotNote)}
                      className="text-xs font-semibold hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#006B3F] rounded px-1 py-1"
                      style={{ color: '#006B3F' }}
                    >
                      Forgot password?
                    </button>

                    {showForgotNote && (
                      <p
                        className="mt-2.5 p-3 rounded-lg text-xs leading-relaxed text-left bg-white/80 border"
                        style={{
                          color: '#0F1F1A',
                          borderColor: 'rgba(0, 107, 63, 0.2)',
                        }}
                      >
                        Contact your System Administrator to reset a forgotten password or unlock an
                        account. Signed-in users can update their password anytime from the top-right{' '}
                        <span className="font-semibold" style={{ color: '#006B3F' }}>
                          User Profile Menu → Reset Password
                        </span>
                        .
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Administrator Authorization Modal */}
      <ActivationAdminAuthModal
        isOpen={showAdminAuthModal}
        onClose={() => setShowAdminAuthModal(false)}
        onAuthorized={handleAdminAuthorized}
      />

      {/* Expiry / Tamper Popup Notification */}
      <ExpiryBlockedModal
        isOpen={shouldShowExpiryPopup}
        startupStatus={startupStatus}
        onRequestAdminRenewal={handleOpenAdminConfig}
      />
    </div>
  );
};
