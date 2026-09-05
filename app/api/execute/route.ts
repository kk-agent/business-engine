// API Route: Pipeline Execution
import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '../../../lib/orchestrator';
import { knowledgeGraph } from '../../../lib/knowledge-graph';
import { ExecuteResponse } from '../../../lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<ExecuteResponse>> {
  try {
    const body = await request.json();
    const { blueprintId, dryRun, skipSkills } = body;

    if (!blueprintId) {
      return NextResponse.json(
        { success: false, error: 'Blueprint ID is required' },
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

    // Store in orchestrator
    orchestrator.storeBlueprint(blueprint);

    // Execute the pipeline
    const execution = await orchestrator.executeBlueprint(blueprintId, {
      dryRun: dryRun || false,
      skipSkills: skipSkills || [],
    });

    // Update blueprint status
    blueprint.status = execution.status === 'completed' ? 'completed' : 'failed';
    blueprint.updatedAt = new Date().toISOString();
    await knowledgeGraph.storeBlueprint(blueprint);

    return NextResponse.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('Execution error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to execute pipeline: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get('executionId');
  const blueprintId = searchParams.get('blueprintId');

  if (executionId) {
    const execution = orchestrator.getExecution(executionId);
    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      execution,
    });
  }

  if (blueprintId) {
    const executions = orchestrator.getBlueprintExecutions(blueprintId);
    return NextResponse.json({
      success: true,
      executions,
      count: executions.length,
    });
  }

  return NextResponse.json({
    message: 'Pipeline Execution API',
    endpoints: {
      POST: 'Execute a blueprint pipeline',
      GET: 'Get execution status',
    },
    example: {
      blueprintId: 'blueprint_123',
      dryRun: false,
      skipSkills: [],
    },
  });
}
