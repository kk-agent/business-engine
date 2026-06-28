// Core Orchestration Engine - Manages the entire pipeline
import {
  Blueprint,
  Skill,
  SkillStatus,
  PipelineExecution,
  ExecutionLog,
  ExecutionResult,
  DAGNode,
  DAGEdge,
} from './types';

export class Orchestrator {
  private blueprints: Map<string, Blueprint> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();

  // Generate unique IDs
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Store a blueprint
  storeBlueprint(blueprint: Blueprint): void {
    this.blueprints.set(blueprint.id, blueprint);
  }

  // Get a blueprint
  getBlueprint(id: string): Blueprint | undefined {
    return this.blueprints.get(id);
  }

  // Get all blueprints
  getAllBlueprints(): Blueprint[] {
    return Array.from(this.blueprints.values());
  }

  // Build execution order from DAG using topological sort
  getExecutionOrder(blueprint: Blueprint): Skill[] {
    const skillMap = new Map(blueprint.skills.map(s => [s.id, s]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const skill of blueprint.skills) {
      inDegree.set(skill.id, 0);
      adjacency.set(skill.id, []);
    }

    // Build adjacency and in-degree
    for (const edge of blueprint.edges) {
      const sourceSkill = blueprint.nodes.find(n => n.id === edge.source)?.skillId;
      const targetSkill = blueprint.nodes.find(n => n.id === edge.target)?.skillId;

      if (sourceSkill && targetSkill) {
        adjacency.get(sourceSkill)?.push(targetSkill);
        inDegree.set(targetSkill, (inDegree.get(targetSkill) || 0) + 1);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: Skill[] = [];

    // Start with nodes that have no dependencies
    Array.from(inDegree.entries()).forEach(([skillId, degree]) => {
      if (degree === 0) {
        queue.push(skillId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const skill = skillMap.get(current);
      if (skill) {
        result.push(skill);
      }

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  // Execute a blueprint
  async executeBlueprint(
    blueprintId: string,
    options: { dryRun?: boolean; skipSkills?: string[] } = {}
  ): Promise<PipelineExecution> {
    const blueprint = this.blueprints.get(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint ${blueprintId} not found`);
    }

    const execution: PipelineExecution = {
      id: this.generateId(),
      blueprintId,
      startedAt: new Date().toISOString(),
      status: 'running',
      logs: [],
      results: [],
    };

    this.executions.set(execution.id, execution);
    this.log(execution, 'info', `Starting execution of blueprint: ${blueprint.name}`);

    const orderedSkills = this.getExecutionOrder(blueprint);
    const skipSet = new Set(options.skipSkills || []);

    for (const skill of orderedSkills) {
      if (skipSet.has(skill.id)) {
        this.log(execution, 'info', `Skipping skill: ${skill.name}`, skill.id);
        skill.status = 'skipped';
        continue;
      }

      execution.currentSkillId = skill.id;
      skill.status = 'running';
      this.log(execution, 'info', `Executing skill: ${skill.name}`, skill.id);

      const startTime = Date.now();

      try {
        if (options.dryRun) {
          this.log(execution, 'info', `[DRY RUN] Would execute: ${skill.name}`, skill.id);
          skill.output = `[DRY RUN] Simulated output for ${skill.name}`;
        } else {
          skill.output = await this.executeSkill(skill, execution);
        }

        skill.status = 'completed';
        execution.results.push({
          skillId: skill.id,
          success: true,
          output: skill.output,
          duration: Date.now() - startTime,
        });

        this.log(execution, 'info', `Completed skill: ${skill.name}`, skill.id);
      } catch (error) {
        skill.status = 'failed';
        const errorMessage = error instanceof Error ? error.message : String(error);

        execution.results.push({
          skillId: skill.id,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        });

        this.log(execution, 'error', `Failed skill: ${skill.name} - ${errorMessage}`, skill.id);
        execution.status = 'failed';
        break;
      }
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
    }

    execution.completedAt = new Date().toISOString();
    this.log(execution, 'info', `Execution ${execution.status}: ${blueprint.name}`);

    // Update blueprint
    blueprint.status = execution.status === 'completed' ? 'completed' : 'failed';
    blueprint.updatedAt = new Date().toISOString();

    return execution;
  }

  // Execute individual skill based on type
  private async executeSkill(skill: Skill, execution: PipelineExecution): Promise<string> {
    switch (skill.type) {
      case 'docker_run':
        return this.executeDockerRun(skill, execution);
      case 'api_call':
        return this.executeApiCall(skill, execution);
      case 'script_execution':
        return this.executeScript(skill, execution);
      case 'configuration':
        return this.executeConfiguration(skill, execution);
      case 'deployment':
        return this.executeDeployment(skill, execution);
      case 'marketing':
        return this.executeMarketing(skill, execution);
      case 'analysis':
        return this.executeAnalysis(skill, execution);
      case 'integration':
        return this.executeIntegration(skill, execution);
      default:
        throw new Error(`Unknown skill type: ${skill.type}`);
    }
  }

  // Skill execution methods (simulated for prototype)
  private async executeDockerRun(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Docker run: ${JSON.stringify(skill.parameters)}`, skill.id);
    // In production, this would actually run Docker commands
    return `Docker container executed successfully for ${skill.name}`;
  }

  private async executeApiCall(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `API call: ${JSON.stringify(skill.parameters)}`, skill.id);
    // In production, this would make actual API calls
    return `API call completed for ${skill.name}`;
  }

  private async executeScript(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Script execution: ${skill.name}`, skill.id);
    return `Script executed successfully for ${skill.name}`;
  }

  private async executeConfiguration(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Configuration: ${skill.name}`, skill.id);
    return `Configuration applied for ${skill.name}`;
  }

  private async executeDeployment(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Deployment: ${skill.name}`, skill.id);
    return `Deployment completed for ${skill.name}`;
  }

  private async executeMarketing(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Marketing: ${skill.name}`, skill.id);
    return `Marketing asset generated for ${skill.name}`;
  }

  private async executeAnalysis(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Analysis: ${skill.name}`, skill.id);
    return `Analysis completed for ${skill.name}`;
  }

  private async executeIntegration(skill: Skill, execution: PipelineExecution): Promise<string> {
    this.log(execution, 'debug', `Integration: ${skill.name}`, skill.id);
    return `Integration completed for ${skill.name}`;
  }

  // Logging helper
  private log(
    execution: PipelineExecution,
    level: ExecutionLog['level'],
    message: string,
    skillId?: string
  ): void {
    execution.logs.push({
      timestamp: new Date().toISOString(),
      level,
      skillId,
      message,
    });
  }

  // Remodel DAG by removing/adding nodes
  remodelDAG(
    blueprint: Blueprint,
    changes: {
      removeSkills?: string[];
      addSkills?: Skill[];
    }
  ): Blueprint {
    const newBlueprint = { ...blueprint, id: this.generateId() };

    // Remove skills
    if (changes.removeSkills) {
      const removeSet = new Set(changes.removeSkills);
      newBlueprint.skills = newBlueprint.skills.filter(s => !removeSet.has(s.id));
      newBlueprint.nodes = newBlueprint.nodes.filter(n => !removeSet.has(n.skillId));
      newBlueprint.edges = newBlueprint.edges.filter(
        e => {
          const sourceNode = blueprint.nodes.find(n => n.id === e.source);
          const targetNode = blueprint.nodes.find(n => n.id === e.target);
          return sourceNode && targetNode &&
                 !removeSet.has(sourceNode.skillId) &&
                 !removeSet.has(targetNode.skillId);
        }
      );

      // Rewire edges for removed nodes
      for (const removedId of changes.removeSkills) {
        const removedNode = blueprint.nodes.find(n => n.skillId === removedId);
        if (!removedNode) continue;

        // Find incoming and outgoing edges
        const incoming = blueprint.edges.filter(e => e.target === removedNode.id);
        const outgoing = blueprint.edges.filter(e => e.source === removedNode.id);

        // Connect predecessors to successors
        for (const inEdge of incoming) {
          for (const outEdge of outgoing) {
            const sourceStillExists = newBlueprint.nodes.some(n => n.id === inEdge.source);
            const targetStillExists = newBlueprint.nodes.some(n => n.id === outEdge.target);

            if (sourceStillExists && targetStillExists) {
              newBlueprint.edges.push({
                id: this.generateId(),
                source: inEdge.source,
                target: outEdge.target,
              });
            }
          }
        }
      }
    }

    // Add skills
    if (changes.addSkills) {
      for (const skill of changes.addSkills) {
        newBlueprint.skills.push(skill);
        newBlueprint.nodes.push({
          id: this.generateId(),
          skillId: skill.id,
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          data: {
            label: skill.name,
            status: 'pending',
            type: skill.type,
          },
        });
      }
    }

    newBlueprint.updatedAt = new Date().toISOString();
    this.storeBlueprint(newBlueprint);

    return newBlueprint;
  }

  // Get execution status
  getExecution(id: string): PipelineExecution | undefined {
    return this.executions.get(id);
  }

  // Get all executions for a blueprint
  getBlueprintExecutions(blueprintId: string): PipelineExecution[] {
    return Array.from(this.executions.values()).filter(e => e.blueprintId === blueprintId);
  }
}

// Singleton instance
export const orchestrator = new Orchestrator();
