/** @jest-environment jsdom */
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RequiredTermsConsent } from '../components/auth/RequiredTermsConsent'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

function Harness() {
  const [agreed, setAgreed] = useState(false)
  return <><RequiredTermsConsent agreed={agreed} onChange={setAgreed} /><button disabled={!agreed}>가입 진행</button></>
}

test('opening and dismissing the full documents never grants consent', () => {
  render(<Harness />)
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '필수약관 동의하기' }))
  const dialog = screen.getByRole('dialog', { name: '필수약관 동의' })
  expect(within(dialog).getByRole('region', { name: '이용약관' })).toBeTruthy()
  expect(within(dialog).queryByRole('region', { name: '개인정보처리방침' })).toBeNull()
  expect(within(dialog).getByRole('heading', { name: '제16조 (준거법 및 관할법원)' })).toBeTruthy()
  expect((screen.getByRole('button', { name: '확인', exact: true }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '약관 창 닫기' }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
})

test('each document requires its own checkbox and confirmation before signup is enabled', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '필수약관 동의하기' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /동의합니다/ }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '확인', exact: true }))
  expect(screen.getByRole('region', { name: '개인정보처리방침' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '이용약관' })).toBeNull()
  expect(screen.getByRole('heading', { name: '제16조 (개인정보처리방침의 변경 및 고지)' })).toBeTruthy()
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect((screen.getByRole('button', { name: '확인', exact: true }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /개인정보처리방침에 동의합니다/ }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '확인', exact: true }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '필수약관 동의완료' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /동의합니다/ }))
  fireEvent.click(screen.getByRole('button', { name: '약관 창 닫기' }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
})

test('dismissing the privacy step leaves consent incomplete and reopens at the terms step', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '필수약관 동의하기' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /이용약관에 동의합니다/ }))
  fireEvent.click(screen.getByRole('button', { name: '확인', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '약관 창 닫기' }))
  expect((screen.getByRole('button', { name: '가입 진행' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '필수약관 동의하기' }))
  expect(screen.getByRole('region', { name: '이용약관' })).toBeTruthy()
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
})
