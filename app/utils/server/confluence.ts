import { parseMarkdownToHtml } from '../markdown';
import type { PublishConfluenceParams, PublishConfluenceResult } from '../../types';

interface ConfluenceRequestBody {
  id?: string;
  type: string;
  title: string;
  space: { key: string };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  version?: {
    number: number;
  };
  ancestors?: { id: string }[];
}

interface ExistingPageSearchResponse {
  results?: Array<{
    id: string;
    title: string;
    version?: {
      number: number;
    };
    _links?: {
      webui?: string;
    };
  }>;
}

function normalizeJiraHost(url: string): string {
  let cleanUrl = url.trim();
  try {
    if (cleanUrl.toLowerCase().startsWith('http')) {
      const urlObj = new URL(cleanUrl);
      cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
  } catch {
    /* keep original */
  }
  return cleanUrl.replace(/\/$/, '');
}

export async function publishConfluencePage({
  jiraUrl,
  email,
  token,
  spaceKey,
  parentId,
  title,
  markdown,
}: PublishConfluenceParams): Promise<PublishConfluenceResult> {
  const cleanUrl = normalizeJiraHost(jiraUrl);
  const credential = Buffer.from(`${email}:${token}`).toString('base64');
  const cleanedMarkdown = markdown.replace(/ \*\(에픽:.*?\)\*/g, '');
  const htmlContent = parseMarkdownToHtml(cleanedMarkdown);

  const formattedSpaceKey = spaceKey.toUpperCase();
  const headers = {
    Authorization: `Basic ${credential}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  let existingPage: { id: string; versionNumber: number } | null = null;
  try {
    const searchUrl = `${cleanUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(formattedSpaceKey)}&title=${encodeURIComponent(title)}&expand=version`;
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as ExistingPageSearchResponse;
      if (searchData.results && searchData.results.length > 0) {
        const found = searchData.results[0];
        existingPage = {
          id: found.id,
          versionNumber: found.version?.number ?? 1,
        };
      }
    }
  } catch (error) {
    console.warn('[Confluence] 기존 페이지 검색 실패 (신규 생성 시도):', error);
  }

  const requestBody: ConfluenceRequestBody = {
    type: 'page',
    title,
    space: { key: formattedSpaceKey },
    body: {
      storage: {
        value: htmlContent,
        representation: 'storage',
      },
    },
  };

  if (parentId?.trim()) {
    requestBody.ancestors = [{ id: parentId.trim() }];
  }

  let targetUrl = `${cleanUrl}/wiki/rest/api/content`;
  let method = 'POST';

  if (existingPage) {
    targetUrl = `${cleanUrl}/wiki/rest/api/content/${existingPage.id}`;
    method = 'PUT';
    requestBody.id = existingPage.id;
    requestBody.version = {
      number: existingPage.versionNumber + 1,
    };
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: JSON.stringify(requestBody),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Confluence API HTTP ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { id: string; title: string; _links?: { webui?: string } };
  const docLink = `${cleanUrl}/wiki${data._links?.webui || ''}`;

  return {
    pageId: data.id,
    title: data.title,
    url: docLink,
  };
}
