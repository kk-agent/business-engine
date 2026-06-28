// Claude API Client - Real LLM integration for intelligent processing
import Anthropic from '@anthropic-ai/sdk';

// Initialize client - uses ANTHROPIC_API_KEY env var automatically
const anthropic = new Anthropic();

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Generic Claude completion
export async function complete(
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<ClaudeResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens || 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find(block => block.type === 'text');

  return {
    content: textContent?.type === 'text' ? textContent.text : '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// Summarize video transcript
export async function summarizeTranscript(transcript: string, title: string): Promise<string[]> {
  const systemPrompt = `You are an expert at analyzing video content and extracting actionable insights.
Your task is to summarize a video transcript into clear, actionable bullet points.
Each bullet should represent a distinct concept, technique, or action item that could be implemented.
Focus on practical, executable items rather than vague concepts.
Return ONLY a JSON array of strings, no other text.`;

  const userPrompt = `Video Title: ${title}

Transcript:
${transcript.substring(0, 50000)}

Extract 8-15 actionable bullet points from this video. Each bullet should be:
- Specific and actionable
- Focused on a single concept or task
- Written in a way that could be converted to a technical task

Return as a JSON array of strings.`;

  const response = await complete(systemPrompt, userPrompt, { maxTokens: 2048 });

  try {
    // Extract JSON array from response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Fallback: split by newlines if JSON parsing fails
    return response.content.split('\n').filter(line => line.trim().length > 0);
  } catch {
    return response.content.split('\n').filter(line => line.trim().length > 0);
  }
}

// Extract skills from summary bullets
export async function extractSkillsFromSummary(
  summary: string[],
  context?: { domain?: string; techStack?: string[] }
): Promise<ExtractedSkill[]> {
  const systemPrompt = `You are an expert at converting high-level requirements into structured, executable skill definitions.
Each skill should be atomic, testable, and deployable.
Return ONLY valid JSON, no markdown or other formatting.`;

  const userPrompt = `Convert these summary points into structured skill definitions:

${summary.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${context?.domain ? `Domain: ${context.domain}` : ''}
${context?.techStack ? `Tech Stack: ${context.techStack.join(', ')}` : ''}

For each point, create a skill with this structure:
{
  "id": "skill_[unique_id]",
  "name": "snake_case_name",
  "description": "Clear description of what this skill does",
  "type": "docker_run|api_call|script_execution|configuration|deployment|marketing|analysis|integration",
  "parameters": {
    "param_name": {
      "type": "string|number|boolean|array|object",
      "required": true|false,
      "description": "What this parameter does",
      "default": "optional default value"
    }
  },
  "dependsOn": [],
  "tags": ["relevant", "tags"],
  "complexity": "low|medium|high"
}

Return a JSON array of skills. Infer logical dependencies between skills.`;

  const response = await complete(systemPrompt, userPrompt, { maxTokens: 8192 });

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch {
    console.error('Failed to parse skills JSON:', response.content.substring(0, 500));
    return [];
  }
}

// Generate deployment artifact
export async function generateArtifact(
  artifactType: string,
  blueprintName: string,
  skills: Array<{ name: string; type: string; description: string }>
): Promise<string> {
  const systemPrompt = `You are an expert DevOps engineer who creates production-ready infrastructure code.
Generate real, working code - not placeholders or examples.
Include proper error handling, security best practices, and comments.`;

  const prompts: Record<string, string> = {
    dockerfile: `Create a production Dockerfile for "${blueprintName}" with these capabilities:
${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}

Requirements:
- Multi-stage build for optimization
- Non-root user for security
- Health checks
- Proper caching of dependencies
- Environment variable support`,

    docker_compose: `Create a docker-compose.yml for "${blueprintName}" with services for:
${skills.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}

Include:
- Proper networking
- Volume mounts for persistence
- Health checks
- Environment variables
- Redis for caching if needed`,

    github_actions: `Create a GitHub Actions CI/CD workflow for "${blueprintName}" that:
- Runs on push to main and PRs
- Lints and tests the code
- Builds Docker image
- Runs security scans
- Deploys to staging on develop branch
- Deploys to production on main branch (manual approval)

Skills to consider:
${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`,

    kubernetes_manifest: `Create Kubernetes manifests for "${blueprintName}" including:
- Namespace
- Deployment with replicas
- Service (ClusterIP)
- Ingress with TLS
- HorizontalPodAutoscaler
- ConfigMap for configuration
- Secret references

For these capabilities:
${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`,

    python_script: `Create a Python pipeline runner script for "${blueprintName}" that:
- Executes skills in dependency order (topological sort)
- Handles errors gracefully
- Logs execution progress
- Supports dry-run mode
- Can skip specific skills

Skills to execute:
${skills.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}`,
  };

  const userPrompt = prompts[artifactType] || `Generate a ${artifactType} for "${blueprintName}" with: ${skills.map(s => s.name).join(', ')}`;

  const response = await complete(systemPrompt, userPrompt, { maxTokens: 8192 });
  return response.content;
}

// Generate marketing content
export async function generateMarketingContent(
  platform: string,
  contentType: string,
  blueprintName: string,
  skills: Array<{ name: string; description: string }>,
  summary: string[]
): Promise<string> {
  const systemPrompt = `You are an expert content marketer specializing in tech and developer tools.
Create engaging, authentic content that resonates with technical audiences.
Avoid buzzwords and focus on real value propositions.`;

  const platformGuidelines: Record<string, string> = {
    twitter: `Twitter/X post (max 280 chars) or thread (multiple tweets separated by ---).
Be concise, use relevant emojis sparingly, include 2-3 hashtags.`,
    linkedin: `Professional LinkedIn post (1000-1500 chars).
Use clear paragraphs, bullet points for key features, professional tone with personality.
End with a question or call to action.`,
    instagram: `Instagram caption (max 2200 chars) with:
- Hook in first line
- Value proposition
- Call to action
- 20-30 relevant hashtags at the end`,
    youtube: `YouTube video script with:
- Intro hook (15 sec)
- Problem statement (30 sec)
- Solution demo (main content)
- Results/benefits (30 sec)
- CTA and outro (15 sec)
Include [B-ROLL], [SCREEN SHARE], [TALKING HEAD] markers.`,
    blog: `Technical blog post (1500-2000 words) with:
- SEO-optimized title
- Introduction with hook
- Problem/solution framework
- Code examples where relevant
- Conclusion with next steps`,
  };

  const userPrompt = `Create ${contentType} content for ${platform} about "${blueprintName}".

Key capabilities:
${skills.slice(0, 5).map(s => `- ${s.name}: ${s.description}`).join('\n')}

Summary points:
${summary.slice(0, 5).map(s => `- ${s}`).join('\n')}

Platform guidelines:
${platformGuidelines[platform] || 'Create appropriate content for the platform.'}

Make it authentic and valuable - not salesy.`;

  const response = await complete(systemPrompt, userPrompt, { maxTokens: 4096 });
  return response.content;
}

// Types
export interface ExtractedSkill {
  id: string;
  name: string;
  description: string;
  type: string;
  parameters: Record<string, {
    type: string;
    required: boolean;
    description: string;
    default?: unknown;
  }>;
  dependsOn: string[];
  tags: string[];
  complexity: 'low' | 'medium' | 'high';
}
