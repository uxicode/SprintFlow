import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { TodoItem } from '../../types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'jeonbongcheol';
const GITHUB_REPO = process.env.GITHUB_REPO || 'sprint-flow';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_FILE_PATH = 'data/todos.json';

const LOCAL_DATA_PATH = path.join(process.cwd(), 'data', 'todos.json');

async function ensureLocalDataFileExists() {
  try {
    await fs.access(LOCAL_DATA_PATH);
  } catch {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

// GitHub REST API: 파일 데이터 및 SHA 조회
async function getGithubFile() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) return { todos: [], sha: null };
    throw new Error(`GitHub API GET 실패 (상태: ${res.status})`);
  }

  const data = await res.json();
  const contentUtf8 = Buffer.from(data.content, 'base64').toString('utf-8');
  const todos: TodoItem[] = JSON.parse(contentUtf8 || '[]');
  return { todos, sha: data.sha };
}

export async function GET() {
  try {
    // 1. GITHUB_TOKEN이 설정된 경우: GitHub REST API 조회
    if (GITHUB_TOKEN) {
      const { todos } = await getGithubFile();
      return NextResponse.json({ success: true, data: todos, source: 'github' });
    }

    // 2. GITHUB_TOKEN이 없는 경우: 로컬 파일 시스템 조회
    await ensureLocalDataFileExists();
    const fileContent = await fs.readFile(LOCAL_DATA_PATH, 'utf-8');
    const todos: TodoItem[] = JSON.parse(fileContent || '[]');
    return NextResponse.json({ success: true, data: todos, source: 'local-fs' });
  } catch (error) {
    console.warn('Todo 데이터 로드 오류:', error);
    return NextResponse.json({ success: false, data: [], message: String(error) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const todos: TodoItem[] = Array.isArray(body) ? body : body.todos || [];
    const jsonContent = JSON.stringify(todos, null, 2);

    // 1. GITHUB_TOKEN이 설정된 경우: GitHub REST API로 파일 자동 커밋
    if (GITHUB_TOKEN) {
      const { sha } = await getGithubFile();
      const base64Content = Buffer.from(jsonContent).toString('base64');

      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'update: todo list via Sprint Flow app',
          content: base64Content,
          sha: sha || undefined,
          branch: GITHUB_BRANCH,
        }),
      });

      if (!putRes.ok) {
        const errJson = await putRes.json();
        throw new Error(`GitHub API 커밋 실패: ${JSON.stringify(errJson)}`);
      }

      return NextResponse.json({ success: true, data: todos, source: 'github' });
    }

    // 2. GITHUB_TOKEN이 없는 경우: 로컬 Node.js 파일 시스템 저장 시도
    try {
      await ensureLocalDataFileExists();
      await fs.writeFile(LOCAL_DATA_PATH, jsonContent, 'utf-8');
      return NextResponse.json({ success: true, data: todos, source: 'local-fs' });
    } catch (fsErr) {
      console.warn('로컬 파일 시스템 쓰기 실패 (Vercel 환경일 수 있음):', fsErr);
      return NextResponse.json({
        success: false,
        isReadOnlyEnv: true,
        message: '서버리스 배포 환경에서는 GITHUB_TOKEN 환경 변수를 설정하면 GitHub 저장소에 자동 커밋됩니다.',
      });
    }
  } catch (error) {
    console.warn('Todo 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 200 }
    );
  }
}
