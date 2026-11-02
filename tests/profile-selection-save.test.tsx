/** @jest-environment jsdom */
import {createRef} from 'react';
import {render,screen,fireEvent,waitFor,act,cleanup} from '@testing-library/react';
import ProfessionSection from '../components/profile-sections/ProfessionSection';
import SpecialtySection from '../components/profile-sections/SpecialtySection';
import type {SectionSaveHandle} from '../components/profile-sections/types';
import {replaceProfileProfessions} from '../app/actions/professions';
import {getOwnSelectedSpecialtyIds,replaceProfileSpecialties} from '../app/actions/specialties';
jest.mock('../app/actions/professions',()=>({getProfessions:async()=>({ok:true,professions:[{id:'p',name:'물리치료사',slug:'pt',sort_order:0}]}),getOwnSelectedProfessions:async()=>({ok:true,professions:[]}),replaceProfileProfessions:jest.fn().mockResolvedValue({ok:true})}));
jest.mock('../app/actions/specialties',()=>({getSpecialties:async()=>({ok:true,specialties:[{id:'s',name:'재활',sort_order:0}]}),getOwnSelectedSpecialtyIds:jest.fn(),replaceProfileSpecialties:jest.fn().mockResolvedValue({ok:true})}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
beforeEach(()=>{jest.clearAllMocks();(getOwnSelectedSpecialtyIds as jest.Mock).mockResolvedValue({ok:true,specialtyIds:['s'],specialties:[{specialtyId:'s',ownerVisible:false}]});});
afterEach(cleanup);
test('missing profession fails before saving, shows popup and red count; selecting restores blue',async()=>{
 const ref=createRef<SectionSaveHandle>();render(<ProfessionSection ref={ref}/>);
 await screen.findByRole('button',{name:'물리치료사'});
 const count=screen.getByText('선택됨: 0/5개').parentElement!;
 expect(count.className).toContain('bg-red-50');
 let result;await act(async()=>{result=await ref.current!.save();});
 expect(result).toEqual({ok:false,error:'직군을 최소 1개 선택해주세요.'});
 expect(replaceProfileProfessions).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'직군을 선택해주세요.'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'확인'}));
 fireEvent.click(screen.getByRole('button',{name:'물리치료사'}));
 expect(screen.getByText('선택됨: 1/5개').parentElement!.className).toContain('bg-blue-50');
 await act(async()=>{await ref.current!.save();});
 expect(replaceProfileProfessions).toHaveBeenCalledWith([{professionId:'p',customLabel:undefined,ownerVisible:true}]);
});
test('empty required specialties block saving, show red popup, then restore on selection',async()=>{
 const ref=createRef<SectionSaveHandle>();render(<SpecialtySection ref={ref}/>);
 await screen.findByText('선택됨: 1/3개');
 fireEvent.click(screen.getByRole('button',{name:'✓ 재활'}));
 expect(screen.getByText('선택됨: 0/3개').parentElement!.className).toContain('bg-red-50');
 await act(async()=>{expect(await ref.current!.save()).toEqual({ok:false,error:'전문분야를 최소 1개 선택해주세요.'});});
 expect(replaceProfileSpecialties).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'전문분야를 선택해주세요.'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'확인'}));
 fireEvent.click(screen.getByRole('button',{name:'재활'}));
 expect(screen.getByText('선택됨: 1/3개').parentElement!.className).toContain('bg-blue-50');
 await act(async()=>{expect(await ref.current!.save()).toEqual({ok:true});});
 expect(replaceProfileSpecialties).toHaveBeenCalledWith([{specialtyId:'s',ownerVisible:false}]);
});
test('failed specialty load cannot accidentally clear saved data',async()=>{
 (getOwnSelectedSpecialtyIds as jest.Mock).mockResolvedValue({ok:false,specialtyIds:[],specialties:[]});
 const ref=createRef<SectionSaveHandle>();render(<SpecialtySection ref={ref}/>);
 await screen.findByRole('alert');
 await act(async()=>{expect((await ref.current!.save()).ok).toBe(false);});
 expect(replaceProfileSpecialties).not.toHaveBeenCalled();
});
