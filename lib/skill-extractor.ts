// Skill Extraction Pipeline - Converts video summaries into atomic skills
import { Skill, SkillType, SkillParameter, VideoSource } from './types';

interface ExtractionContext {
  domain?: string;
  industry?: string;
  techStack?: string[];
  businessGoals?: string[];
}

export class SkillExtractor {
  private generateId(): string {
    return `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // Main extraction method - converts summary bullets to skills
  async extractSkills(
    summary: string[],
    context: ExtractionContext = {}
  ): Promise<Skill[]> {
    const skills: Skill[] = [];
    const skillPatterns = this.getSkillPatterns();

    for (let i = 0; i < summary.length; i++) {
      const bullet = summary[i];
      const extractedSkills = this.analyzeBullet(bullet, i, skillPatterns, context);
      skills.push(...extractedSkills);
    }

    // Infer dependencies between skills
    this.inferDependencies(skills);

    // Add meta-skills for orchestration
    skills.push(...this.generateMetaSkills(skills, context));

    return skills;
  }

  // Analyze a single bullet point and extract skills
  private analyzeBullet(
    bullet: string,
    index: number,
    patterns: Map<RegExp, unknown>,
    context: ExtractionContext
  ): Skill[] {
    const skills: Skill[] = [];
    const lowerBullet = bullet.toLowerCase();

    // Check each pattern
    Array.from(patterns.entries()).forEach(([pattern, template]) => {
      if (pattern.test(lowerBullet)) {
        const skill = this.createSkillFromTemplate(bullet, template as SkillTemplate, index, context);
        skills.push(skill);
      }
    });

    // If no pattern matched, create a generic skill
    if (skills.length === 0) {
      skills.push(this.createGenericSkill(bullet, index, context));
    }

    return skills;
  }

  // Pattern definitions for different skill types
  private getSkillPatterns() {
    return new Map([
      // Docker/Container patterns
      [
        /self[- ]host|docker|container|deploy locally/i,
        {
          type: 'docker_run',
          namePrefix: 'self_host',
          tags: ['infrastructure', 'self-hosted', 'docker'],
          complexity: 'medium',
          parameters: {
            image: { type: 'string', required: true, description: 'Docker image to run' },
            port: { type: 'number', required: false, default: 3000, description: 'Port to expose' },
            volumes: { type: 'array', required: false, description: 'Volume mounts' },
          },
        },
      ],
      // API/Integration patterns
      [
        /api|endpoint|integrate|connect to|webhook/i,
        {
          type: 'api_call',
          namePrefix: 'api_integration',
          tags: ['api', 'integration'],
          complexity: 'medium',
          parameters: {
            endpoint: { type: 'string', required: true, description: 'API endpoint URL' },
            method: { type: 'string', required: false, default: 'GET', description: 'HTTP method' },
            headers: { type: 'object', required: false, description: 'Request headers' },
          },
        },
      ],
      // Discord/Platform patterns
      [
        /discord|slack|teams|platform/i,
        {
          type: 'integration',
          namePrefix: 'platform_setup',
          tags: ['platform', 'chat', 'integration'],
          complexity: 'low',
          parameters: {
            platform: { type: 'string', required: true, description: 'Platform name' },
            botToken: { type: 'string', required: true, description: 'Bot authentication token' },
            channelId: { type: 'string', required: false, description: 'Target channel ID' },
          },
        },
      ],
      // Automation patterns
      [
        /automat|email|schedule|cron|workflow/i,
        {
          type: 'script_execution',
          namePrefix: 'automation',
          tags: ['automation', 'workflow'],
          complexity: 'medium',
          parameters: {
            schedule: { type: 'string', required: false, description: 'Cron schedule expression' },
            trigger: { type: 'string', required: false, description: 'Event trigger type' },
            actions: { type: 'array', required: true, description: 'Actions to perform' },
          },
        },
      ],
      // AI/ML patterns
      [
        /ai|machine learning|model|persona|llm|gpt|claude/i,
        {
          type: 'configuration',
          namePrefix: 'ai_setup',
          tags: ['ai', 'ml', 'configuration'],
          complexity: 'high',
          parameters: {
            modelName: { type: 'string', required: true, description: 'AI model identifier' },
            systemPrompt: { type: 'string', required: false, description: 'System prompt for the model' },
            temperature: { type: 'number', required: false, default: 0.7, description: 'Model temperature' },
          },
        },
      ],
      // Deployment patterns
      [
        /deploy|production|release|publish|launch/i,
        {
          type: 'deployment',
          namePrefix: 'deploy',
          tags: ['deployment', 'production'],
          complexity: 'high',
          parameters: {
            environment: { type: 'string', required: true, description: 'Deployment environment' },
            strategy: { type: 'string', required: false, default: 'rolling', description: 'Deployment strategy' },
            healthCheck: { type: 'string', required: false, description: 'Health check endpoint' },
          },
        },
      ],
      // Marketing patterns
      [
        /market|social|content|post|campaign|brand/i,
        {
          type: 'marketing',
          namePrefix: 'marketing',
          tags: ['marketing', 'content'],
          complexity: 'low',
          parameters: {
            platform: { type: 'string', required: true, description: 'Marketing platform' },
            contentType: { type: 'string', required: true, description: 'Type of content' },
            audience: { type: 'string', required: false, description: 'Target audience' },
          },
        },
      ],
      // Analysis patterns
      [
        /analyz|research|study|competitor|market size|trend/i,
        {
          type: 'analysis',
          namePrefix: 'analysis',
          tags: ['analysis', 'research'],
          complexity: 'medium',
          parameters: {
            analysisType: { type: 'string', required: true, description: 'Type of analysis' },
            dataSource: { type: 'string', required: false, description: 'Data source' },
            metrics: { type: 'array', required: false, description: 'Metrics to analyze' },
          },
        },
      ],
    ]);
  }

  // Create skill from template
  private createSkillFromTemplate(
    bullet: string,
    template: SkillTemplate,
    index: number,
    context: ExtractionContext
  ): Skill {
    const cleanName = this.extractKeyPhrase(bullet);

    // Transform parameters to array format with name property
    const parameters: SkillParameter[] = Object.entries(template.parameters).map(
      ([key, value]) => ({ ...value, name: key })
    );

    return {
      id: this.generateId(),
      name: `${template.namePrefix}_${cleanName}`,
      description: bullet,
      type: template.type,
      parameters,
      dependsOn: [],
      tags: Array.from(new Set([...template.tags, ...(context.techStack || [])])),
      complexity: template.complexity,
      status: 'pending',
    };
  }

  // Create generic skill when no pattern matches
  private createGenericSkill(
    bullet: string,
    index: number,
    context: ExtractionContext
  ): Skill {
    const cleanName = this.extractKeyPhrase(bullet);

    return {
      id: this.generateId(),
      name: `task_${cleanName}`,
      description: bullet,
      type: 'configuration',
      parameters: [
        {
          name: 'action',
          type: 'string',
          required: true,
          description: 'Action to perform',
        },
      ],
      dependsOn: [],
      tags: ['general', ...(context.techStack || [])],
      complexity: 'low',
      status: 'pending',
    };
  }

  // Extract key phrase from bullet for naming
  private extractKeyPhrase(bullet: string): string {
    // Remove common words and clean up
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again',
      'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    ]);

    const words = bullet
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Take first 3 meaningful words
    return words.slice(0, 3).join('_') || `step_${Date.now()}`;
  }

  // Infer dependencies between skills
  private inferDependencies(skills: Skill[]): void {
    const typeOrder: Record<SkillType, number> = {
      configuration: 1,
      docker_run: 2,
      integration: 3,
      api_call: 4,
      script_execution: 5,
      deployment: 6,
      marketing: 7,
      analysis: 8,
    };

    // Sort skills by type order
    skills.sort((a, b) => (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5));

    // Infer dependencies based on type relationships
    for (let i = 1; i < skills.length; i++) {
      const current = skills[i];
      const previous = skills[i - 1];

      // Add dependency if types suggest sequence
      if (this.shouldDepend(current.type, previous.type)) {
        current.dependsOn.push(previous.id);
      }
    }

    // Add semantic dependencies
    for (const skill of skills) {
      for (const other of skills) {
        if (skill.id === other.id) continue;

        // Check if skill description references another skill's name
        if (
          skill.description.toLowerCase().includes(other.name.replace(/_/g, ' ')) ||
          this.hasSemanticDependency(skill, other)
        ) {
          if (!skill.dependsOn.includes(other.id)) {
            skill.dependsOn.push(other.id);
          }
        }
      }
    }
  }

  // Check if one type should depend on another
  private shouldDepend(currentType: SkillType, previousType: SkillType): boolean {
    const dependencies: Record<SkillType, SkillType[]> = {
      docker_run: ['configuration'],
      integration: ['docker_run', 'configuration'],
      api_call: ['integration', 'docker_run'],
      script_execution: ['api_call', 'integration'],
      deployment: ['docker_run', 'script_execution'],
      marketing: ['deployment'],
      analysis: ['deployment', 'marketing'],
      configuration: [],
    };

    return dependencies[currentType]?.includes(previousType) || false;
  }

  // Check semantic dependency
  private hasSemanticDependency(skill: Skill, other: Skill): boolean {
    const dependencyKeywords: Record<SkillType, string[]> = {
      deployment: ['setup', 'configure', 'build', 'create'],
      marketing: ['deploy', 'launch', 'publish'],
      analysis: ['collect', 'deploy', 'run'],
      api_call: ['setup', 'configure'],
      integration: ['setup', 'configure'],
      docker_run: ['configure'],
      script_execution: ['setup', 'integrate'],
      configuration: [],
    };

    const keywords = dependencyKeywords[skill.type] || [];
    const otherDesc = other.description.toLowerCase();

    return keywords.some(kw => otherDesc.includes(kw));
  }

  // Generate meta-skills for orchestration
  private generateMetaSkills(skills: Skill[], context: ExtractionContext): Skill[] {
    const metaSkills: Skill[] = [];

    // Add initialization skill
    metaSkills.push({
      id: this.generateId(),
      name: 'pipeline_init',
      description: 'Initialize the pipeline environment and validate prerequisites',
      type: 'configuration',
      parameters: [
        {
          name: 'environment',
          type: 'string',
          required: true,
          description: 'Target environment',
        },
      ],
      dependsOn: [],
      tags: ['meta', 'orchestration'],
      complexity: 'low',
      status: 'pending',
    });

    // Add finalization skill
    const deploySkills = skills.filter(s => s.type === 'deployment');
    metaSkills.push({
      id: this.generateId(),
      name: 'pipeline_finalize',
      description: 'Finalize pipeline execution and generate reports',
      type: 'script_execution',
      parameters: [
        {
          name: 'reportFormat',
          type: 'string',
          required: false,
          default: 'json',
          description: 'Output format for the execution report',
        },
      ],
      dependsOn: deploySkills.map(s => s.id),
      tags: ['meta', 'orchestration'],
      complexity: 'low',
      status: 'pending',
    });

    return metaSkills;
  }
}

interface SkillTemplate {
  type: SkillType;
  namePrefix: string;
  tags: string[];
  complexity: 'low' | 'medium' | 'high';
  parameters: Record<string, Omit<SkillParameter, 'name'>>;
}

// Singleton instance
export const skillExtractor = new SkillExtractor();
