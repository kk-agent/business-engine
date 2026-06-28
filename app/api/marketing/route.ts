// API Route: Marketing Asset Generation - REAL Claude-powered content creation
import { NextRequest, NextResponse } from 'next/server';
import { generateMarketingContent } from '../../../lib/claude-client';
import { knowledgeGraph } from '../../../lib/knowledge-graph';
import { MarketingGenerator } from '../../../lib/marketing-generator';
import { MarketingResponse, Platform, MarketingType, MarketingAsset } from '../../../lib/types';
import { isProTier } from '@/lib/usage';

const validPlatforms: Platform[] = ['twitter', 'linkedin', 'instagram', 'youtube', 'blog', 'email'];
const validTypes: MarketingType[] = ['post', 'thread', 'carousel', 'video_script', 'article', 'newsletter'];

export async function POST(request: NextRequest): Promise<NextResponse<MarketingResponse>> {
  try {
    const body = await request.json();
    const { blueprintId, platforms, types } = body;

    if (!blueprintId) {
      return NextResponse.json(
        { success: false, error: 'Blueprint ID is required' },
        { status: 400 }
      );
    }

    const pro = isProTier(request);
    const requestedPlatforms: Platform[] = pro
      ? (platforms || ['twitter', 'linkedin'])
      : ['twitter'];
    const invalidPlatforms = requestedPlatforms.filter(p => !validPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid platforms: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate types
    const requestedTypes: MarketingType[] = pro ? (types || ['post']) : ['post'];
    const invalidTypes = requestedTypes.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid types: ${invalidTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the blueprint
    const blueprint = await knowledgeGraph.getBlueprintById(blueprintId);
    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: 'Blueprint not found' },
        { status: 404 }
      );
    }

    console.log(`[Marketing] Generating content for ${requestedPlatforms.length} platforms`);

    const assets: MarketingAsset[] = [];

    if (pro) {
      for (const platform of requestedPlatforms) {
        for (const contentType of requestedTypes) {
          const skillsForPrompt = blueprint.skills.slice(0, 5).map(s => ({
            name: s.name,
            description: s.description,
          }));
          const content = await generateMarketingContent(
            platform,
            contentType,
            blueprint.name,
            skillsForPrompt,
            blueprint.videoSource?.summary || [],
          );
          assets.push({
            id: `marketing_${Date.now()}_${platform}_${contentType}`,
            platform,
            type: contentType,
            content,
            hashtags: extractHashtags(content),
            suggestedPostTime: getSuggestedPostTime(platform),
            generatedAt: new Date().toISOString(),
          });
        }
      }
    } else {
      const generator = new MarketingGenerator();
      const generated = await generator.generateAssets(blueprint, requestedPlatforms, requestedTypes);
      for (const asset of generated) {
        const lines = asset.content.split('\n');
        const preview =
          lines.length > 12
            ? `${lines.slice(0, 12).join('\n')}\n\n— Upgrade to Pro for full marketing pack`
            : asset.content;
        assets.push({
          ...asset,
          content: preview,
          hashtags: asset.hashtags || extractHashtags(preview),
          suggestedPostTime: getSuggestedPostTime(asset.platform),
        });
      }
    }

    // Update blueprint with generated assets
    blueprint.marketingAssets = [...(blueprint.marketingAssets || []), ...assets];
    blueprint.updatedAt = new Date().toISOString();
    await knowledgeGraph.storeBlueprint(blueprint);

    return NextResponse.json({
      success: true,
      assets,
    });
  } catch (error) {
    console.error('Marketing generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate marketing assets';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Extract hashtags from generated content
function extractHashtags(content: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = content.match(hashtagRegex);
  return matches ? [...new Set(matches)] : [];
}

// Get optimal posting time based on platform analytics
function getSuggestedPostTime(platform: Platform): string {
  const optimalTimes: Record<Platform, string> = {
    twitter: '09:00 AM EST',
    linkedin: '10:00 AM EST',
    instagram: '11:00 AM EST',
    youtube: '2:00 PM EST',
    blog: '8:00 AM EST',
    email: '10:00 AM EST',
  };
  return optimalTimes[platform] || '10:00 AM EST';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') as Platform | null;

  if (platform && validPlatforms.includes(platform)) {
    return NextResponse.json({
      platform,
      optimalTiming: {
        bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
        bestTimes: getSuggestedPostTime(platform),
        frequency: platform === 'twitter' ? '3-5 per day' : '1-2 per day',
      },
    });
  }

  return NextResponse.json({
    message: 'Marketing Asset Generation API',
    description: 'Uses Claude to generate platform-specific marketing content',
    availablePlatforms: validPlatforms,
    availableTypes: validTypes,
    endpoints: {
      POST: 'Generate marketing assets for a blueprint using AI',
      GET: 'Get optimal posting times for a platform',
    },
    example: {
      blueprintId: 'blueprint_123',
      platforms: ['twitter', 'linkedin', 'blog'],
      types: ['post', 'thread', 'article'],
    },
  });
}
