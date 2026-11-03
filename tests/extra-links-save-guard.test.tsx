/** @jest-environment jsdom */
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExtraLinksSection from '@/components/profile-sections/ExtraLinksSection';
import { getOwnExtraLinks, saveExtraLinks } from '@/app/actions/extra-links';
import type { SectionSaveHandle } from '@/components/profile-sections/types';
jest.mock('@/app/actions/extra-links',()=>({getOwnExtraLinks:jest.fn(),saveExtraLinks:jest.fn().mockResolvedValue({ok:true})}));
afterEach(()=>{cleanup();jest.clearAllMocks();});
test('P0-08: saving must be blocked while existing links are still loading',async()=>{
 (getOwnExtraLinks as jest.Mock).mockReturnValue(new Promise(()=>{}));
 const ref=createRef<SectionSaveHandle>();render(<ExtraLinksSection ref={ref}/>);
 expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
 expect(screen.getByRole('button',{name:'+ 링크 추가'})).toBeDisabled();
 expect(ref.current!.validate!().ok).toBe(false);
 let result;await act(async()=>{result=await ref.current!.save();});
 expect(saveExtraLinks).not.toHaveBeenCalled();
 expect(result).toEqual(expect.objectContaining({ok:false}));
});
test('P0-08: failed existing-link loading must not clear saved links',async()=>{
 (getOwnExtraLinks as jest.Mock).mockResolvedValue({ok:false,error:'simulated failure',links:[]});
 const ref=createRef<SectionSaveHandle>();await act(async()=>{render(<ExtraLinksSection ref={ref}/>);});
 expect(screen.getByRole('alert')).toHaveTextContent('기존 링크 보호');
 expect(screen.getByRole('button',{name:'+ 링크 추가'})).toBeDisabled();
 await act(async()=>{await ref.current!.save();});
 expect(saveExtraLinks).not.toHaveBeenCalled();
});
test('P0-08: after a successful load, saving preserves the existing links',async()=>{
 (getOwnExtraLinks as jest.Mock).mockResolvedValue({ok:true,links:[{id:'test',label:'sample',url:'https://example.com/'}]});
 const ref=createRef<SectionSaveHandle>();await act(async()=>{render(<ExtraLinksSection ref={ref}/>);});
 await act(async()=>{await ref.current!.save();});
 expect(saveExtraLinks).toHaveBeenCalledWith({links:[{label:'sample',url:'https://example.com/'}]});
});

test('a rejected load blocks saving and offers a retry',async()=>{
 (getOwnExtraLinks as jest.Mock).mockRejectedValue(new Error('simulated transport failure'));
 const ref=createRef<SectionSaveHandle>();await act(async()=>{render(<ExtraLinksSection ref={ref}/>);});
 expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했습니다');
 expect(screen.queryByText('simulated transport failure')).not.toBeInTheDocument();
 await act(async()=>{expect((await ref.current!.save()).ok).toBe(false);});
 expect(saveExtraLinks).not.toHaveBeenCalled();
});

test('retrying a failed load restores the saved links before saving is allowed',async()=>{
 (getOwnExtraLinks as jest.Mock).mockResolvedValueOnce({ok:false,links:[]}).mockResolvedValueOnce({ok:true,links:[{id:'test',label:'sample',url:'https://example.com/'}]});
 const ref=createRef<SectionSaveHandle>();await act(async()=>{render(<ExtraLinksSection ref={ref}/>);});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'다시 불러오기'}));});
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.getByDisplayValue('sample')).toBeInTheDocument();
 expect(ref.current!.validate!()).toEqual({ok:true});
 await act(async()=>{expect(await ref.current!.save()).toEqual({ok:true});});
 expect(saveExtraLinks).toHaveBeenCalledWith({links:[{label:'sample',url:'https://example.com/'}]});
});

test('after a successful load, deliberately deleting all links still saves an empty list',async()=>{
 (getOwnExtraLinks as jest.Mock).mockResolvedValue({ok:true,links:[{id:'test',label:'sample',url:'https://example.com/'}]});
 const ref=createRef<SectionSaveHandle>();await act(async()=>{render(<ExtraLinksSection ref={ref}/>);});
 fireEvent.click(screen.getByRole('button',{name:'삭제'}));
 await act(async()=>{expect(await ref.current!.save()).toEqual({ok:true});});
 expect(saveExtraLinks).toHaveBeenCalledWith({links:[]});
});
