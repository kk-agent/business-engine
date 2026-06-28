// YouTube Service - Real transcript fetching and video metadata
import { YoutubeTranscript } from 'youtube-transcript';

export interface YouTubeVideoInfo {
  id: string;
  url: string;
  title: string;
  transcript: string;
  duration: number;
  thumbnailUrl: string;
}

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Fetch transcript from YouTube
export async function fetchTranscript(videoIdOrUrl: string): Promise<{
  transcript: string;
  segments: TranscriptSegment[];
}> {
  const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;

  try {
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    const segments: TranscriptSegment[] = transcriptData.map(item => ({
      text: item.text,
      start: item.offset / 1000, // Convert to seconds
      duration: item.duration / 1000,
    }));

    // Combine into full transcript
    const transcript = segments.map(s => s.text).join(' ');

    return { transcript, segments };
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    throw new Error(`Failed to fetch transcript for video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fetch video metadata using oEmbed (no API key needed)
export async function fetchVideoMetadata(videoIdOrUrl: string): Promise<{
  title: string;
  author: string;
  thumbnailUrl: string;
}> {
  const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`oEmbed request failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.title || 'Unknown Title',
      author: data.author_name || 'Unknown Author',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    // Return fallback metadata
    return {
      title: 'Video',
      author: 'Unknown',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }
}

// Full video info fetch
export async function fetchVideoInfo(videoIdOrUrl: string): Promise<YouTubeVideoInfo> {
  const videoId = extractVideoId(videoIdOrUrl);

  if (!videoId) {
    throw new Error('Invalid YouTube URL or video ID');
  }

  const [transcriptResult, metadata] = await Promise.all([
    fetchTranscript(videoId),
    fetchVideoMetadata(videoId),
  ]);

  // Estimate duration from transcript segments
  const lastSegment = transcriptResult.segments[transcriptResult.segments.length - 1];
  const estimatedDuration = lastSegment ? lastSegment.start + lastSegment.duration : 0;

  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: metadata.title,
    transcript: transcriptResult.transcript,
    duration: estimatedDuration,
    thumbnailUrl: metadata.thumbnailUrl,
  };
}

// Chunk transcript for processing (useful for long videos)
export function chunkTranscript(
  transcript: string,
  maxChunkSize: number = 10000
): string[] {
  const words = transcript.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(word);
    currentSize += word.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}
