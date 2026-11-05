/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { DamoaWorkspace } from '../app/my/damoa/DamoaWorkspace';
import { saveActivity } from '../lib/damoa/server-store';

jest.mock('../lib/damoa/server-store', () => ({
  loadActivities: jest.fn().mockResolvedValue([]),
  loadFileUsage: jest.fn().mockResolvedValue(0),
  saveActivity: jest.fn().mockResolvedValue({}),
  pendingBrowserActivities: jest.fn().mockResolvedValue([]),
  FILE_LIMIT: 10 * 1024 * 1024,
}));
jest.mock('../lib/damoa/browser-store', () => ({ loadActivities: jest.fn().mockResolvedValue([]) }));

beforeAll(() => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'test-id' });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

async function openUpload() {
  render(<DamoaWorkspace owner="test-owner" />);
  await waitFor(() => expect((screen.getByRole('button', { name: /자료 올리기/ }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: /자료 올리기/ }));
  const target = screen.getByRole('button', { name: /사진·자료 선택/ });
  return { dialog: target.closest('dialog')!, target };
}

test('dropping a supported image attaches it without saving', async () => {
  const { target } = await openUpload();
  fireEvent.drop(target, { dataTransfer: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  expect(screen.getByText('photo.png')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'photo.png 첨부 해제' })).toBeTruthy();
});

test('region and organizer follow the activity name and are included when saved', async () => {
  await openUpload();
  fireEvent.change(screen.getByPlaceholderText('어떤 경험인지 짧게 적어주세요'), { target: { value: '지역 봉사' } });
  fireEvent.change(screen.getByLabelText('지역'), { target: { value: '성남시' } });
  fireEvent.change(screen.getByLabelText('주관'), { target: { value: '자원봉사센터' } });
  const region = screen.getByLabelText('지역');
  const organizer = screen.getByLabelText('주관');
  expect(region.compareDocumentPosition(organizer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '비공개로 저장' }));
  await waitFor(() => expect(saveActivity).toHaveBeenCalledWith(expect.objectContaining({ details: { 지역: '성남시', 주관: '자원봉사센터' } })));
});

test('dropping an oversized image keeps the file size limit', async () => {
  const { target } = await openUpload();
  const file = new File(['image'], 'large.png', { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
  fireEvent.drop(target, { dataTransfer: { files: [file] } });
  expect(screen.getByText('파일은 한 개당 10MB 이하로 첨부해주세요.')).toBeTruthy();
  expect(screen.queryByText('large.png')).toBeNull();
});

test('cancel from an overlay preserves the draft; the explicit close button closes it', async () => {
  const { dialog } = await openUpload();
  const title = screen.getByPlaceholderText('어떤 경험인지 짧게 적어주세요');
  fireEvent.change(title, { target: { value: '작성 중인 경험' } });
  const cancel = new Event('cancel', { bubbles: true, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect((title as HTMLInputElement).value).toBe('작성 중인 경험');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '작성창 닫기' }));
  expect(dialog.open).toBe(false);
  confirm.mockRestore();
});
