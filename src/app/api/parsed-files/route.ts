import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { readdir, readFile, stat, unlink } from 'fs/promises';

const parsedDir = join(process.cwd(), 'src', 'data', 'parsed');

const isSafeJson = (name: string) =>
  name.endsWith('.json') && !name.includes('..') && !name.includes('/');

export async function GET() {
  try {
    const files = await readdir(parsedDir);
    const jsonFiles = files.filter(isSafeJson);

    const entries = await Promise.all(
      jsonFiles.map(async (file) => {
        const fullPath = join(parsedDir, file);
        const [content, stats] = await Promise.all([
          readFile(fullPath, 'utf-8'),
          stat(fullPath),
        ]);

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(content);
        } catch (err) {
          parsed = { error: 'invalid-json', message: (err as Error).message };
        }

        return {
          file,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          content: parsed,
        };
      })
    );

    // 최신 수정순으로 정렬
    entries.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );

    return NextResponse.json({ files: entries });
  } catch (error) {
    console.error('Failed to read parsed files', error);
    return NextResponse.json(
      {
        error: 'Unable to read parsed files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('file');

  if (!filename || !isSafeJson(filename)) {
    return NextResponse.json(
      { error: 'Invalid filename' },
      { status: 400 }
    );
  }

  try {
    await unlink(join(parsedDir, filename));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete file ${filename}`, error);
    return NextResponse.json(
      {
        error: 'Unable to delete file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
