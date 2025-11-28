import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ProgramItem } from '@/types/domain';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const upstageApiKey = process.env.UPSTAGE_API_KEY;
    if (!upstageApiKey) {
      return NextResponse.json(
        { error: 'Upstage API key not configured' },
        { status: 500 }
      );
    }

    // Step 1: PDF를 마크다운으로 파싱
    const upstageFormData = new FormData();
    upstageFormData.append('document', file);
    upstageFormData.append('output_formats', 'markdown');

    const parseResponse = await fetch(
      'https://api.upstage.ai/v1/document-ai/document-parse',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstageApiKey}`,
        },
        body: upstageFormData,
      }
    );

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error('Upstage Parse API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to parse PDF with Upstage API' },
        { status: parseResponse.status }
      );
    }

    const parseData = await parseResponse.json();
    const markdownContent = parseData.content?.markdown || parseData.markdown || '';

    if (!markdownContent) {
      return NextResponse.json(
        { error: 'No markdown content extracted from PDF' },
        { status: 500 }
      );
    }

    // Step 2: Solar LLM으로 프로그램 정보 추출
    const solarResponse = await fetch(
      'https://api.upstage.ai/v1/solar/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'solar-pro',
          messages: [
            {
              role: 'system',
              content: `당신은 문서에서 프로그램(일자리, 정책, 교육 등) 정보를 추출하는 전문가입니다.
주어진 마크다운 문서에서 시니어(노인)를 위한 프로그램 정보를 모두 추출하여 JSON 배열로 반환하세요.

각 프로그램은 다음 형식을 따라야 합니다:
{
  "title": "프로그램 제목",
  "type": "job" | "policy" | "education" | "other",
  "region": "지역 (예: 부산, 울산, 경남)",
  "target_age": "대상 연령 (예: 60세 이상)",
  "description": "프로그램 설명",
  "benefits": "혜택 내용",
  "requirements": "신청 자격 또는 요구사항",
  "duration": "기간",
  "cost": "비용",
  "start_date": "시작일",
  "deadline": "마감일",
  "contact": "연락처",
  "link": "URL",
  "tags": ["태그1", "태그2"],
  "provider": "제공 기관"
}

반드시 JSON 배열 형태로만 응답하세요. 다른 설명은 포함하지 마세요.`,
            },
            {
              role: 'user',
              content: `다음 문서에서 프로그램 정보를 추출해주세요:\n\n${markdownContent}`,
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!solarResponse.ok) {
      const errorText = await solarResponse.text();
      console.error('Solar API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to extract programs with Solar LLM' },
        { status: solarResponse.status }
      );
    }

    const solarData = await solarResponse.json();
    const extractedText =
      solarData.choices?.[0]?.message?.content || '[]';

    // JSON 파싱
    let programs: ProgramItem[] = [];
    try {
      // LLM이 코드 블록으로 감쌀 수 있으므로 제거
      const cleanedText = extractedText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      programs = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse extracted program data' },
        { status: 500 }
      );
    }

    // Step 3: 추출된 프로그램 데이터를 JSON 파일로 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `programs-${timestamp}.json`;
    const dataDir = join(process.cwd(), 'src', 'data', 'parsed');

    try {
      await mkdir(dataDir, { recursive: true });
    } catch (err) {
      // 디렉토리가 이미 존재하는 경우 무시
    }

    const filepath = join(dataDir, filename);

    // ID 자동 생성
    const programsWithIds = programs.map((program, idx) => ({
      id: `prog-${timestamp}-${idx}`,
      ...program,
    }));

    await writeFile(
      filepath,
      JSON.stringify(
        {
          filename: file.name,
          timestamp: new Date().toISOString(),
          programs: programsWithIds,
        },
        null,
        2
      )
    );

    return NextResponse.json({
      filename: file.name,
      timestamp: new Date().toISOString(),
      programs: programsWithIds,
      savedTo: filename,
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
