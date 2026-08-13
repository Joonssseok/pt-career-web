import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  ImageRun,
  Footer,
  VerticalAlign,
  HeightRule,
} from 'docx';
import type { ResumeData } from '@/app/actions/resume';
import { ACADEMIC_LEVEL_LABELS } from '@/lib/constants/academic-levels';

// 대표 승인 레이아웃(2026-08-13 지시서 참고 구현)을 그대로 재현한다.
// 색상/폰트/표 구조/컬럼 폭/섹션 순서는 하드코딩 값이 아니라 이 파일의
// 상수·헬퍼로 고정하고, 실제 렌더링 내용만 ResumeData로 채운다.

const FONT = '맑은 고딕';
const BLUE = '1D4ED8';
const GRAY = '6B7280';
const LIGHT_GRAY = 'D1D5DB';
const HEAD_BG = 'F3F4F6';
const CONTENT_WIDTH = 10106; // A4(11906) - margins(900*2)

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
}
function thinBorder(color = LIGHT_GRAY) {
  return { style: BorderStyle.SINGLE, size: 4, color };
}
function cellBorders(color = LIGHT_GRAY) {
  return {
    top: thinBorder(color),
    bottom: thinBorder(color),
    left: thinBorder(color),
    right: thinBorder(color),
  };
}
function noCellBorders() {
  return { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() };
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 180, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 22, color: BLUE, font: FONT })],
  });
}

function labelValueRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 1500, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' },
        borders: cellBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: FONT })] })],
      }),
      new TableCell({
        width: { size: 5300, type: WidthType.DXA },
        borders: cellBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 18, font: FONT })] })],
      }),
    ],
  });
}

// headers: string[], rows: string[][], colWidths: number[] (DXA, 합계가 표 폭과 같아야 함)
function dataTable(headers: string[], rows: string[][], colWidths: number[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' },
          borders: cellBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 70, bottom: 70, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, size: 18, font: FONT })],
            }),
          ],
        })
    ),
  });
  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cellText, i) =>
            new TableCell({
              width: { size: colWidths[i], type: WidthType.DXA },
              borders: cellBorders(),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                  children: [new TextRun({ text: cellText, size: 18, font: FONT })],
                }),
              ],
            })
        ),
      })
  );
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
  });
}

function formatRange(start: string, end: string, isCurrently?: boolean): string {
  if (!start) return '';
  if (isCurrently) return `${start} ~ 현재`;
  if (!end) return start;
  return `${start} ~ ${end}`;
}

export type ResumePhoto = { buffer: Buffer; type: 'jpg' | 'png' } | null;

function buildPhotoBlock(photo: ResumePhoto) {
  if (photo) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: photo.type,
            data: photo.buffer,
            transformation: { width: 132, height: 170 },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: '프로필 사진', size: 14, color: GRAY, font: FONT })],
      }),
    ];
  }

  // 사진이 없거나(webp 등) docx가 지원하지 않는 형식이면 자리표시 박스로
  // 대체한다. 132pt x 170pt 이미지와 같은 크기(1pt = 20 twips/DXA).
  return [
    new Table({
      width: { size: 2640, type: WidthType.DXA },
      rows: [
        new TableRow({
          height: { value: 3400, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 2640, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' },
              borders: cellBorders(),
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '사진 없음', size: 16, color: GRAY, font: FONT })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

export async function buildResumeDocx(data: ResumeData, photo: ResumePhoto): Promise<Buffer> {
  // 인적사항 표 -- 전문분야/활동지역/전화번호는 값이 없으면 행 자체를
  // 생략한다(지시서 확정 사항). 성명/직군/총경력/이메일은 항상 표시.
  const professionText = data.professionNames.filter(Boolean).join(' · ');
  const specialtyText = data.specialtyNames.filter(Boolean).join(', ');

  const infoRows: TableRow[] = [
    labelValueRow('성명(활동명)', data.displayName),
    labelValueRow('직군', professionText),
  ];
  if (specialtyText) infoRows.push(labelValueRow('전문분야', specialtyText));
  infoRows.push(labelValueRow('총 경력', `${data.totalExperienceYears}년`));
  if (data.workplaceRegion) infoRows.push(labelValueRow('활동지역', data.workplaceRegion));
  if (data.phone) infoRows.push(labelValueRow('전화번호', data.phone));
  infoRows.push(labelValueRow('이메일', data.email));

  const infoTable = new Table({
    width: { size: 6800, type: WidthType.DXA },
    columnWidths: [1500, 5300],
    rows: infoRows,
  });

  const titleBlock = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: '이 력 서', bold: true, size: 44, font: FONT })],
  });

  const headerTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7106],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            borders: noCellBorders(),
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 0, bottom: 0, left: 0, right: 200 },
            children: buildPhotoBlock(photo),
          }),
          new TableCell({
            width: { size: 7106, type: WidthType.DXA },
            borders: noCellBorders(),
            verticalAlign: VerticalAlign.TOP,
            children: [infoTable],
          }),
        ],
      }),
    ],
  });

  const sectionChildren: Array<Paragraph | Table> = [titleBlock, headerTable, new Paragraph({ text: '' })];

  // 섹션 순서: 경력사항 -> 학력사항 -> 자격·면허사항 -> 교육이수사항.
  // 취업용 이력서라 자기소개/근무기관/온라인프로필 섹션은 넣지 않는다
  // (지시서 배경 -- 마케팅용 프로필 소개가 아니라 사실 위주 문서).
  // 0건인 섹션은 제목+표를 통째로 생략(사이트의 기존 "값 없으면 섹션
  // 숨김" 컨벤션과 동일한 원칙).

  if (data.experiences.length > 0) {
    sectionChildren.push(sectionHeading('경력사항'));
    sectionChildren.push(
      dataTable(
        ['근무기간', '근무기관', '직책'],
        data.experiences.map((e) => [
          formatRange(e.startDate, e.endDate, e.isCurrently),
          e.organizationName,
          e.position,
        ]),
        [2400, 4906, 2800]
      )
    );
  }

  if (data.academicRecords.length > 0) {
    sectionChildren.push(sectionHeading('학력사항'));
    sectionChildren.push(
      dataTable(
        ['기간', '학교 / 전공', '구분'],
        data.academicRecords.map((r) => [
          formatRange(r.startDate, r.endDate),
          r.major ? `${r.schoolName} / ${r.major}` : r.schoolName,
          r.degree ? `${ACADEMIC_LEVEL_LABELS[r.level]}(${r.degree})` : ACADEMIC_LEVEL_LABELS[r.level],
        ]),
        [2400, 5306, 2400]
      )
    );
  }

  if (data.certifications.length > 0) {
    sectionChildren.push(sectionHeading('자격·면허사항'));
    sectionChildren.push(
      dataTable(
        ['자격증명', '구분', '발급기관', '취득일'],
        data.certifications.map((c) => [c.name, c.category, c.issuer, c.issueDate]),
        [3200, 2000, 2906, 2000]
      )
    );
  }

  if (data.educations.length > 0) {
    sectionChildren.push(sectionHeading('교육이수사항'));
    sectionChildren.push(
      dataTable(
        ['이수일자', '교육 / 연수명', '기관'],
        data.educations.map((e) => [e.completionDate || e.startDate, e.educationName, e.organizationName]),
        [2000, 5106, 3000]
      )
    );
  }

  const generatedDate = new Date().toISOString().slice(0, 10);

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 850, bottom: 850, left: 900, right: 900 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LIGHT_GRAY, space: 4 } },
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: `본 이력서는 PT Career(pt-career.kr) 프로필을 기반으로 자동 생성되었습니다   ·   생성일: ${generatedDate}`,
                    size: 15,
                    color: GRAY,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sectionChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
