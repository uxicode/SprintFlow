import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { formatWeekHeader } from '../weeklyExcelData';
import type { WeeklyExcelPayload } from '../../types';

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD');
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('');
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text;
  }
  return String(value);
}

function findSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const matched = workbook.worksheets.find((sheet) => /개발/.test(sheet.name));
  if (matched) return matched;
  const fallback = workbook.worksheets.find((sheet) => {
    let found = false;
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (/전주/.test(cellText(cell.value)) && /진척/.test(cellText(cell.value))) found = true;
      });
    });
    return found;
  });
  if (!fallback) throw new Error('개발본부 시트 또는 전주 진척사항 칸을 찾지 못했습니다.');
  return fallback;
}

function findHeaderCell(
  sheet: ExcelJS.Worksheet,
  includesAll: string[],
): ExcelJS.Cell | null {
  let result: ExcelJS.Cell | null = null;
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const text = cellText(cell.value);
      if (includesAll.every((token) => text.includes(token))) result = cell;
    });
  });
  return result;
}

function replaceWeekDates(original: string, start: string, end: string, prefix: string, suffix: string): string {
  const next = formatWeekHeader(prefix, start, end, suffix);
  if (/전주\([^)]*\)\s*진척사항/.test(original) && prefix === '전주') {
    return original.replace(/전주\([^)]*\)\s*진척사항/, next);
  }
  if (/금주\([^)]*\)\s*예정사항/.test(original) && prefix === '금주') {
    return original.replace(/금주\([^)]*\)\s*예정사항/, next);
  }
  return next;
}

function findDevUnitContentCells(sheet: ExcelJS.Worksheet): { previous: ExcelJS.Cell; next: ExcelJS.Cell } {
  let labelRow = 0;
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      if (cellText(cell.value).includes('②개발 유닛')) labelRow = rowNumber;
    });
  });
  if (!labelRow) throw new Error('②개발 유닛 칸을 찾지 못했습니다.');
  return {
    previous: sheet.getCell(labelRow + 1, 5),
    next: sheet.getCell(labelRow + 1, 12),
  };
}

export async function updateWeeklyExcelWorkbook(
  fileBuffer: ArrayBuffer | Buffer,
  payload: WeeklyExcelPayload,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const input = fileBuffer instanceof ArrayBuffer ? Buffer.from(new Uint8Array(fileBuffer)) : Buffer.from(fileBuffer);
  await workbook.xlsx.load(input as unknown as ExcelJS.Buffer);
  const sheet = findSheet(workbook);

  const previousHeader = findHeaderCell(sheet, ['전주', '진척사항']);
  const nextHeader = findHeaderCell(sheet, ['금주', '예정사항']);
  if (previousHeader) {
    previousHeader.value = replaceWeekDates(
      cellText(previousHeader.value),
      payload.dateStart,
      payload.dateEnd,
      '전주',
      '진척사항',
    );
  }
  if (nextHeader) {
    const nextStart = dayjs(payload.dateStart).add(7, 'day').format('YYYY-MM-DD');
    const nextEnd = dayjs(payload.dateEnd).add(7, 'day').format('YYYY-MM-DD');
    nextHeader.value = replaceWeekDates(
      cellText(nextHeader.value),
      nextStart,
      nextEnd,
      '금주',
      '예정사항',
    );
  }

  const { previous, next } = findDevUnitContentCells(sheet);
  previous.value = payload.previousWeekText || previous.value;
  next.value = payload.nextWeekPlanText || next.value;
  previous.alignment = { ...(previous.alignment || {}), wrapText: true, vertical: 'top' };
  next.alignment = { ...(next.alignment || {}), wrapText: true, vertical: 'top' };

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(new Uint8Array(output));
}
