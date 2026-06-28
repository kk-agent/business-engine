// API Route: Video Ingestion - REAL YouTube transcript fetching with Claude summarization
import { NextRequest, NextResponse } from 'next/server';
import { VideoSource, IngestResponse } from '../../../lib/types';
import { fetchVideoInfo, extractVideoId } from '../../../lib/youtube-service';
import { summarizeTranscript } from '../../../lib/claude-client';

export async function POST(request: NextRequest): Promise<NextResponse<IngestResponse>> {
  try {
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Extract video ID from URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    console.log(`[Ingest] Fetching video info for: ${videoId}`);

    // Fetch real video info (transcript + metadata)
    const videoInfo = await fetchVideoInfo(videoId);

    console.log(`[Ingest] Got transcript (${videoInfo.transcript.length} chars) for: ${videoInfo.title}`);

    // Use Claude to summarize the transcript into actionable bullet points
    console.log(`[Ingest] Summarizing transcript with Claude...`);
    const summary = await summarizeTranscript(videoInfo.transcript, videoInfo.title);

    console.log(`[Ingest] Generated ${summary.length} summary points`);

    const videoSource: VideoSource = {
      id: `video_${Date.now()}_${videoId}`,
      url: youtubeUrl,
      title: videoInfo.title,
      transcript: videoInfo.transcript,
      summary,
      extractedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      videoSource,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to ingest video';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Video Ingestion API',
    description: 'Fetches real YouTube transcripts and uses Claude to generate summaries',
    endpoints: {
      POST: 'Submit a YouTube URL to extract transcript and AI-generated summary',
    },
    example: {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  });
}
