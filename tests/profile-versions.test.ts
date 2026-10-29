import { activityForProfile, applyVersion, BASE_SECTIONS, type VersionContent } from '../lib/profile-versions/types';
import type { ExpertProfileViewProps } from '../components/experts/ExpertProfileView';
const base = {id:'fixed-person-id',headline:'공개 소개',introduction:'원래 소개',experiences:[{organization_name:'기관'}],academic_records:[],educations:[],licenses:[{license_name:'자격'}],total_experience_years:4} as unknown as ExpertProfileViewProps['expert'];
const content:VersionContent={headline:'다른 소개',introduction:'새 소개',sections:[],activities:[]};
test('대표 교체 시 원래 공유 ID를 유지하고 원본 객체를 변경하지 않음',()=>{
 const next=applyVersion(base,content);expect(next.id).toBe(base.id);expect(next.headline).toBe('다른 소개');expect(base.headline).toBe('공개 소개');
});
test('숨긴 공통 이력과 경력 연수는 표시하지 않음',()=>{const next=applyVersion(base,content);expect(next.experiences).toEqual([]);expect(next.licenses).toEqual([]);expect(next.total_experience_years).toBeNull();});
test('선택한 이력만 다시 표시',()=>{const next=applyVersion(base,{...content,sections:BASE_SECTIONS.map(s=>s.id)});expect(next.experiences).toEqual(base.experiences);expect(next.licenses).toEqual(base.licenses);});
test('다모아를 가져올 때 개인 메모·첨부 원본·내부 소유자를 전달하지 않음',()=>{
 const row={id:'record',title:'봉사',period:'2026',description:'공개할 활동',learning:'배운 점',memo:'비공개 메모',owner:'private-user',files:[{name:'private.pdf'}]};
 const publicItem=activityForProfile(row,'봉사활동');expect(Object.keys(publicItem).sort()).toEqual(['id','category','title','period','description','learning'].sort());expect(JSON.stringify(publicItem)).not.toContain('비공개 메모');expect(JSON.stringify(publicItem)).not.toContain('private.pdf');
});
