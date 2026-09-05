// API Route: Knowledge Graph Operations
import { NextRequest, NextResponse } from 'next/server';
import { hasPrivilegedAccess, unauthorizedMutationResponse } from '@/lib/auth';
import { knowledgeGraph } from '../../../lib/knowledge-graph';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats': {
        const stats = await knowledgeGraph.getSkillStats();
        return NextResponse.json({
          success: true,
          stats,
        });
      }

      case 'export': {
        const data = await knowledgeGraph.exportGraph();
        return NextResponse.json({
          success: true,
          graph: JSON.parse(data),
        });
      }

      case 'skills': {
        const types = searchParams.get('types')?.split(',');
        const tags = searchParams.get('tags')?.split(',');
        const searchText = searchParams.get('search');

        const skills = await knowledgeGraph.querySkills({
          types,
          tags,
          searchText: searchText || undefined,
        });

        return NextResponse.json({
          success: true,
          skills,
          count: skills.length,
        });
      }

      case 'related': {
        const skillId = searchParams.get('skillId');
        if (!skillId) {
          return NextResponse.json(
            { success: false, error: 'skillId is required' },
            { status: 400 }
          );
        }

        const related = await knowledgeGraph.findRelatedSkills(skillId);
        return NextResponse.json({
          success: true,
          related,
        });
      }

      case 'blueprints': {
        const tags = searchParams.get('tags')?.split(',');
        const status = searchParams.get('status');
        const searchText = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') as 'createdAt' | 'updatedAt' | 'name' | 'skillCount' | undefined;
        const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;
        const limit = searchParams.get('limit');
        const offset = searchParams.get('offset');

        const blueprints = await knowledgeGraph.queryBlueprints({
          tags,
          status: status as 'draft' | 'ready' | 'executing' | 'completed' | 'failed' | undefined,
          searchText: searchText || undefined,
          sortBy,
          sortOrder,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        });

        return NextResponse.json({
          success: true,
          blueprints,
          count: blueprints.length,
        });
      }

      default: {
        const graph = knowledgeGraph.getGraph();
        return NextResponse.json({
          success: true,
          summary: {
            totalBlueprints: graph.blueprints.length,
            totalSkills: graph.skills.length,
            totalRelationships: graph.relationships.length,
            tags: graph.tags,
            lastUpdated: graph.lastUpdated,
          },
        });
      }
    }
  } catch (error) {
    console.error('Knowledge graph error:', error);
    return NextResponse.json(
      { success: false, error: 'Knowledge graph operation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasPrivilegedAccess(request)) {
    return unauthorizedMutationResponse();
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'import': {
        const { data } = body;
        if (!data) {
          return NextResponse.json(
            { success: false, error: 'Graph data is required' },
            { status: 400 }
          );
        }
        await knowledgeGraph.importGraph(JSON.stringify(data));
        return NextResponse.json({
          success: true,
          message: 'Graph imported successfully',
        });
      }

      case 'delete': {
        const { blueprintId } = body;
        if (!blueprintId) {
          return NextResponse.json(
            { success: false, error: 'Blueprint ID is required' },
            { status: 400 }
          );
        }
        const deleted = await knowledgeGraph.deleteBlueprint(blueprintId);
        return NextResponse.json({
          success: deleted,
          message: deleted ? 'Blueprint deleted' : 'Blueprint not found',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Knowledge graph POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Knowledge graph operation failed' },
      { status: 500 }
    );
  }
}
