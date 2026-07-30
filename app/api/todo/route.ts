import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { TodoItem } from '../../types';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'todos.json');

async function ensureDataFileExists() {
  try {
    await fs.access(DATA_FILE_PATH);
  } catch {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

export async function GET() {
  try {
    await ensureDataFileExists();
    const fileContent = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    const todos: TodoItem[] = JSON.parse(fileContent || '[]');
    return NextResponse.json({ success: true, data: todos });
  } catch (error) {
    console.error('Todo 데이터 로드 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Todo 데이터를 읽는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDataFileExists();
    const body = await request.json();
    const todos: TodoItem[] = Array.isArray(body) ? body : body.todos || [];

    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(todos, null, 2), 'utf-8');
    return NextResponse.json({ success: true, data: todos });
  } catch (error) {
    console.error('Todo 데이터 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Todo 데이터를 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
