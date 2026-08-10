'use client';

import React, { useState } from 'react';
import ParticleBackground from './ParticleBackground';
import './LoginScreen.css';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Particle reveal 5-click state
  const [clickCount, setClickCount] = useState(0);
  const [isFormRevealed, setIsFormRevealed] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  // Title 3-click disassemble state
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [isTitlePulsing, setIsTitlePulsing] = useState(false);

  const handleLogoClick = () => {
    if (isFormRevealed) return;

    // Trigger visual pulse animation
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 300);

    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    if (nextCount >= 5) {
      setIsFormRevealed(true);
      setTitleClickCount(0);
    }
  };

  const handleTitleClick = () => {
    if (!isFormRevealed) return;

    // Trigger visual pulse animation for title
    setIsTitlePulsing(true);
    setTimeout(() => setIsTitlePulsing(false), 300);

    const nextCount = titleClickCount + 1;
    setTitleClickCount(nextCount);

    if (nextCount >= 3) {
      // Disassemble form back to particles
      setIsFormRevealed(false);
      setClickCount(0);
      setTitleClickCount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error || '로그인에 실패했습니다.');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess();
    } catch (err) {
      console.error('로그인 에러:', err);
      setErrorMessage('서버와 통신하는 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`login-screen-container ${isFormRevealed ? 'form-revealed' : 'initial-particles-mode'}`}>
      {/* High-performance Three.js Particle Background */}
      <ParticleBackground clickCount={clickCount} isFormRevealed={isFormRevealed} />

      <div className="login-glow-bg"></div>

      <div className={`login-card ${isFormRevealed ? 'card-expanded' : 'card-compact'}`}>
        {/* Brand Header with clickable Logo Wrapper */}
        <div className="login-header">
          <div
            className={`login-logo-wrapper ${isPulsing ? 'logo-pulse' : ''} ${!isFormRevealed ? 'interactive-clickable' : ''}`}
            onClick={handleLogoClick}
            title={!isFormRevealed ? `로고를 5번 클릭하면 로그인 창이 나타납니다 (${clickCount}/5)` : undefined}
          >
            <span className="login-logo-icon">⚡</span>
            <span className="login-logo-text">SprintFlow</span>
            {!isFormRevealed && (
              <span className="click-counter-badge">
                {clickCount}/5
              </span>
            )}
          </div>

          <div className="revealable-content">
            <h1
              className={`login-title ${isFormRevealed ? 'interactive-title-clickable' : ''} ${isTitlePulsing ? 'title-pulse' : ''}`}
              onClick={handleTitleClick}
              title={isFormRevealed ? `타이틀을 3번 클릭하면 파티클로 분해됩니다 (${titleClickCount}/3)` : undefined}
            >
              <span>관리자 대시보드 로그인</span>
              {isFormRevealed && (
                <span className="title-counter-badge">
                  {titleClickCount}/3
                </span>
              )}
            </h1>
            <p className="login-subtitle">
              일감 운영 및 업무 보고서 관리 시스템에 접근하려면 인증이 필요합니다.
            </p>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="login-form">
              {errorMessage && (
                <div className="login-error-banner">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="login-field-group">
                <label htmlFor="admin-username" className="login-label">
                  관리자 아이디
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="admin-username"
                    type="text"
                    className="login-input"
                    placeholder="관리자 아이디 입력"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting || !isFormRevealed}
                    autoComplete="username"
                    autoFocus={isFormRevealed}
                  />
                </div>
              </div>

              <div className="login-field-group">
                <label htmlFor="admin-password" className="login-label">
                  비밀번호
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting || !isFormRevealed}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-button" disabled={isSubmitting || !isFormRevealed}>
                {isSubmitting ? (
                  <span className="login-loading-spinner"></span>
                ) : (
                  <>
                    <span>대시보드 로그인</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Security Footer */}
            <div className="login-footer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Vercel 환경 변수로 관리되는 보호된 대시보드입니다.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

