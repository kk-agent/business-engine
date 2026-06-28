// API Route: DAG Construction
import { NextRequest, NextResponse } from 'next/server';
import { dagBuilder } from '../../../lib/dag-builder';
import { knowledgeGraph } from '../../../lib/knowledge-graph';
import { DAGResponse, VideoSource } from '../../../lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<DAGResponse>> {
  try {
    const body = await request.json();
    const { skills, blueprintName, description, videoSource } = body;

    if (!skills || !Array.isArray(skills)) {
      return NextResponse.json(
        { success: false, error: 'Skills array is required' },
        { status: 400 }
      );
    }

    if (!blueprintName) {
      return NextResponse.json(
        { success: false, error: 'Blueprint name is required' },
        { status: 400 }
      );
    }

    // Create default video source if not provided
    const source: VideoSource = videoSource || {
      id: `video_${Date.now()}`,
      url: 'manual-input',
      title: blueprintName,
      transcript: '',
      summary: skills.map((s: { description: string }) => s.description),
      extractedAt: new Date().toISOString(),
    };

    // Build the blueprint with DAG
    const blueprint = dagBuilder.buildBlueprint(
      skills,
      source,
      blueprintName,
      description || `Blueprint for ${blueprintName}`
    );

    // Validate the DAG
    const validation = dagBuilder.validateDAG(blueprint);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `DAG validation failed: ${validation.issues.map(i => i.message).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Optimize the DAG
    const optimizedBlueprint = dagBuilder.optimizeDAG(blueprint);

    // Store in knowledge graph
    await knowledgeGraph.storeBlueprint(optimizedBlueprint);

    return NextResponse.json({
      success: true,
      blueprint: optimizedBlueprint,
    });
  } catch (error) {
    console.error('DAG construction error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to construct DAG' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format');

    if (id) {
      const blueprint = await knowledgeGraph.getBlueprintById(id);
      if (!blueprint) {
        return NextResponse.json(
          { success: false, error: 'Blueprint not found' },
          { status: 404 }
        );
      }

      // Export in requested format
      if (format === 'mermaid') {
        return NextResponse.json({
          success: true,
          format: 'mermaid',
          content: dagBuilder.exportAsMermaid(blueprint),
        });
      }

      if (format === 'dot') {
        return NextResponse.json({
          success: true,
          format: 'dot',
          content: dagBuilder.exportAsDOT(blueprint),
        });
      }

      return NextResponse.json({
        success: true,
        blueprint,
      });
    }

    // Return all blueprints
    const blueprints = await knowledgeGraph.queryBlueprints({});
    return NextResponse.json({
      success: true,
      blueprints,
      count: blueprints.length,
    });
  } catch (error) {
    console.error('DAG fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch DAG' },
      { status: 500 }
    );
  }
}
