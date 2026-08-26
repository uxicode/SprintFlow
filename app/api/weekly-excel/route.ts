import { NextRequest, NextResponse } from 'next/server';
import { updateWeeklyExcelWorkbook } from '../../utils/server/updateWeeklyExcel';
import type { WeeklyExcelPayload } from '../../types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawPayload = formData.get('payload');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '엑셀 파일이 필요합니다.' }, { status: 400 });
    }
    if (typeof rawPayload !== 'string') {
      return NextResponse.json({ error: '주간 업무 데이터가 필요합니다.' }, { status: 400 });
    }

    const payload = JSON.parse(rawPayload) as WeeklyExcelPayload;
    const buffer = await file.arrayBuffer();
    const updated = await updateWeeklyExcelWorkbook(buffer, payload);
    const originalName = file.name.replace(/\.xlsx$/i, '');
    const filename = `${originalName}_updated.xlsx`;

    return new NextResponse(new Uint8Array(updated), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[weekly-excel]', error);
    return NextResponse.json({ error: `엑셀 업데이트 실패: ${message}` }, { status: 500 });
  }
}
