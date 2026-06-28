// API Route: Artifact Generation - REAL Claude-powered infrastructure code generation
import { NextRequest, NextResponse } from 'next/server';
import { generateArtifact } from '../../../lib/claude-client';
import { knowledgeGraph } from '../../../lib/knowledge-graph';
import { ArtifactGenerator } from '../../../lib/artifact-generator';
import { ArtifactResponse, ArtifactType, Artifact } from '../../../lib/types';
import { isProTier } from '@/lib/auth';

const PREVIEW_LINES = 20;

const validArtifactTypes: ArtifactType[] = [
  'dockerfile',
  'docker_compose',
  'github_actions',
  'gitlab_ci',
  'openapi_spec',
  'kubernetes_manifest',
  'terraform',
  'python_script',
  'bash_script',
];

export async function POST(request: NextRequest): Promise<NextResponse<ArtifactResponse>> {
  try {
    const body = await request.json();
    const { blueprintId, artifactTypes } = body;

    if (!blueprintId) {
      return NextResponse.json(
        { success: false, error: 'Blueprint ID is required' },
        { status: 400 }
      );
    }

    const pro = isProTier(request);
    const types: ArtifactType[] = pro
      ? (artifactTypes || ['dockerfile', 'docker_compose', 'github_actions'])
      : ['dockerfile'];
    const invalidTypes = types.filter(t => !validArtifactTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid artifact types: ${invalidTypes.join(', ')}` },
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

    console.log(`[Artifacts] Generating ${types.length} artifacts for blueprint: ${blueprint.name}`);

    const artifacts: Artifact[] = [];

    if (pro) {
      for (const artifactType of types) {
        console.log(`[Artifacts] Generating ${artifactType} with Claude...`);
        const skillsForPrompt = blueprint.skills.slice(0, 10).map(s => ({
          name: s.name,
          type: s.type,
          description: s.description,
        }));
        const content = await generateArtifact(artifactType, blueprint.name, skillsForPrompt);
        artifacts.push({
          id: `artifact_${Date.now()}_${artifactType}`,
          type: artifactType,
          name: getArtifactName(artifactType),
          content,
          generatedAt: new Date().toISOString(),
        });
      }
    } else {
      const generator = new ArtifactGenerator();
      const generated = await generator.generateArtifacts(blueprint, types);
      for (const artifact of generated) {
        const lines = artifact.content.split('\n');
        const preview =
          lines.length > PREVIEW_LINES
            ? `${lines.slice(0, PREVIEW_LINES).join('\n')}\n# … Upgrade to Pro for full export (${lines.length} lines)`
            : artifact.content;
        artifacts.push({ ...artifact, content: preview });
      }
    }

    // Update blueprint with generated artifacts
    blueprint.artifacts = [...(blueprint.artifacts || []), ...artifacts];
    blueprint.updatedAt = new Date().toISOString();
    await knowledgeGraph.storeBlueprint(blueprint);

    return NextResponse.json({
      success: true,
      artifacts,
    });
  } catch (error) {
    console.error('Artifact generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate artifacts';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

function getArtifactName(type: ArtifactType): string {
  const nameMap: Record<ArtifactType, string> = {
    dockerfile: 'Dockerfile',
    docker_compose: 'docker-compose.yml',
    github_actions: '.github/workflows/ci-cd.yml',
    gitlab_ci: '.gitlab-ci.yml',
    openapi_spec: 'openapi.yaml',
    kubernetes_manifest: 'k8s-manifests.yaml',
    terraform: 'main.tf',
    python_script: 'pipeline_runner.py',
    bash_script: 'deploy.sh',
  };
  return nameMap[type] || type;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Artifact Generation API',
    description: 'Uses Claude to generate production-ready infrastructure code',
    availableTypes: validArtifactTypes,
    endpoints: {
      POST: 'Generate artifacts for a blueprint using AI',
    },
    example: {
      blueprintId: 'blueprint_123',
      artifactTypes: ['dockerfile', 'github_actions', 'kubernetes_manifest'],
    },
  });
}
