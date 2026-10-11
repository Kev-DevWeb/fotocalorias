import type { NextRequest } from 'next/server';
import { handleAnalyzeRequest } from '@/lib/ai/handle-request';

export const POST = (request: NextRequest) => handleAnalyzeRequest(request, 'image');

export const runtime = 'nodejs';
export const maxDuration = 30;
