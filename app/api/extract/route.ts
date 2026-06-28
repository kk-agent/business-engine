// API Route: Skill Extraction - REAL Claude-powered skill extraction
import { NextRequest, NextResponse } from 'next/server';
import { extractSkillsFromSummary } from '../../../lib/claude-client';
import { ExtractResponse, Skill } from '../../../lib/types';
import { isProTier } from '@/lib/auth';

function heuristicSkills(summary: string[]): Skill[] {
  const batch = Date.now();
  return summary.slice(0, 8).map((point, index) => ({
    id: `skill_${batch}_${index}`,
    name: point.length > 48 ? `${point.slice(0, 45)}…` : point,
    description: point,
    type: 'script_execution' as const,
    status: 'pending' as const,
    parameters: [],
    dependsOn: index > 0 ? [`skill_${batch}_${index - 1}`] : [],
    tags: ['starter', 'template'],
    estimatedDuration: 600,
    createdAt: new Date().toISOString(),
  }));
}

export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
  try {
    const body = await request.json();
    const { summary, context } = body;

    if (!summary || !Array.isArray(summary)) {
      return NextResponse.json(
        { success: false, error: 'Summary array is required' },
        { status: 400 }
      );
    }

    const pro = isProTier(request);
    console.log(`[Extract] Processing ${summary.length} points (${pro ? 'claude' : 'template'})...`);

    if (!pro) {
      return NextResponse.json({ success: true, skills: heuristicSkills(summary) });
    }

    const extractedSkills = await extractSkillsFromSummary(summary, context || {});
    console.log(`[Extract] Produced ${extractedSkills.length} skills`);

    const skills: Skill[] = extractedSkills.map((skill, index) => ({
      id: skill.id || `skill_${Date.now()}_${index}`,
      name: skill.name,
      description: skill.description,
      type: mapSkillType(skill.type),
      status: 'pending' as const,
      parameters: Object.entries(skill.parameters || {}).map(([name, param]) => ({
        name,
        type: mapParamType(param.type),
        required: param.required,
        description: param.description,
        default: param.default,
      })),
      dependsOn: skill.dependsOn || [],
      tags: skill.tags || [],
      estimatedDuration: estimateDuration(skill.complexity),
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      skills,
    });
  } catch (error) {
    console.error('Extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract skills';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Map Claude's skill types to our defined types
function mapSkillType(type: string): Skill['type'] {
  const typeMap: Record<string, Skill['type']> = {
    docker_run: 'docker_run',
    api_call: 'api_call',
    script_execution: 'script_execution',
    configuration: 'configuration',
    deployment: 'deployment',
    marketing: 'marketing',
    analysis: 'analysis',
    integration: 'integration',
  };
  return typeMap[type.toLowerCase()] || 'script_execution';
}

// Map parameter types to our defined types
function mapParamType(type: string): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  const typeMap: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
    integer: 'number',
    float: 'number',
    list: 'array',
    dict: 'object',
    bool: 'boolean',
  };
  return typeMap[type.toLowerCase()] || 'string';
}

// Estimate duration based on complexity
function estimateDuration(complexity: string): number {
  const durationMap: Record<string, number> = {
    low: 300,      // 5 minutes
    medium: 900,   // 15 minutes
    high: 1800,    // 30 minutes
  };
  return durationMap[complexity] || 600;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Skill Extraction API',
    description: 'Uses Claude to extract structured, executable skills from summary points',
    endpoints: {
      POST: 'Extract skills from a summary array using AI',
    },
    example: {
      summary: [
        'Self-host the application on your own server for data control',
        'Configure Discord bot integration for team collaboration',
        'Set up automated email workflows with AI prioritization',
      ],
      context: {
        domain: 'productivity',
        techStack: ['docker', 'discord', 'nodejs'],
      },
    },
  });
}
