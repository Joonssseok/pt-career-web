'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setOwnResumePhone } from '@/app/actions/profile';

type FieldState = 'default' | 'loading' | 'saved' | 'error';

export function AccountInfoForm({
  initialEmail,
  initialPhone,
  hasProfile,
}: {
  initialEmail: string;
  initialPhone: string;
  hasProfile: boolean;
}) {
  const supabase = createClient();

  // 이메일
  const [email, setEmail] = useState(initialEmail);
  const [emailState, setEmailState] = useState<FieldState>('default');
  const [emailMessage, setEmailMessage] = useState('');

  const handleEmailSave = async () => {
    const trimmed = email.trim();
    if (!trimmed || trimmed === initialEmail) return;
    setEmailState('loading');
    setEmailMessage('');
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (error) {
      setEmailState('error');
      setEmailMessage(error.message);
    } else {
      setEmailState('saved');
      setEmailMessage('확인 이메일을 보냈습니다. 새 이메일의 링크를 눌러야 변경이 완료됩니다.');
    }
  };

  // 비밀번호
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordState, setPasswordState] = useState<FieldState>('default');
  const [passwordMessage, setPasswordMessage] = useState('');

  const handlePasswordSave = async () => {
    if (password.length < 8) {
      setPasswordState('error');
      setPasswordMessage('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordState('error');
      setPasswordMessage('비밀번호가 일치하지 않습니다');
      return;
    }
    setPasswordState('loading');
    setPasswordMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordState('error');
      setPasswordMessage(error.message);
    } else {
      setPasswordState('saved');
      setPasswordMessage('비밀번호가 변경되었습니다.');
      setPassword('');
      setPasswordConfirm('');
    }
  };

  // 전화번호 (resume_phone -- 이력서 다운로드 전용, 공개 프로필에 노출 안 됨)
  const [phone, setPhone] = useState(initialPhone);
  const [phoneState, setPhoneState] = useState<FieldState>('default');
  const [phoneMessage, setPhoneMessage] = useState('');

  const handlePhoneSave = async () => {
    setPhoneState('loading');
    setPhoneMessage('');
    const result = await setOwnResumePhone(phone);
    if (result.ok) {
      setPhoneState('saved');
      setPhoneMessage('저장되었습니다.');
    } else {
      setPhoneState('error');
      setPhoneMessage(result.error ?? '저장에 실패했습니다.');
    }
  };

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">이메일</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailState('default');
            }}
            disabled={emailState === 'loading'}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleEmailSave}
            disabled={emailState === 'loading' || !email.trim() || email.trim() === initialEmail}
            className="min-h-[44px] px-4 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {emailState === 'loading' ? '변경 중...' : '변경'}
          </button>
        </div>
        {emailMessage && (
          <p className={`text-xs mt-1 ${emailState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {emailMessage}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">비밀번호 변경</label>
        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordState('default');
            }}
            placeholder="새 비밀번호 (8자 이상)"
            disabled={passwordState === 'loading'}
            className={inputClass}
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => {
              setPasswordConfirm(e.target.value);
              setPasswordState('default');
            }}
            placeholder="새 비밀번호 확인"
            disabled={passwordState === 'loading'}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handlePasswordSave}
            disabled={passwordState === 'loading' || !password || !passwordConfirm}
            className="w-full min-h-[44px] px-4 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {passwordState === 'loading' ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
        {passwordMessage && (
          <p className={`text-xs mt-1 ${passwordState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {passwordMessage}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          전화번호 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        {hasProfile ? (
          <>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneState('default');
                }}
                placeholder="예: 010-1234-5678"
                disabled={phoneState === 'loading'}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handlePhoneSave}
                disabled={phoneState === 'loading'}
                className="min-h-[44px] px-4 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {phoneState === 'loading' ? '저장 중...' : '저장'}
              </button>
            </div>
            <p className="text-[12px] text-gray-400 mt-1 leading-tight">
              이력서 다운로드 시에만 사용되며 공개 프로필에는 노출되지 않습니다.
            </p>
            {phoneMessage && (
              <p className={`text-xs mt-1 ${phoneState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {phoneMessage}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">전문가 프로필을 먼저 만들어야 전화번호를 저장할 수 있어요.</p>
        )}
      </div>
    </div>
  );
}
