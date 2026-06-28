// DAG Builder - Constructs dependency graphs from skills
import { Skill, DAGNode, DAGEdge, Blueprint, VideoSource } from './types';

export class DAGBuilder {
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Build a complete blueprint from skills
  buildBlueprint(
    skills: Skill[],
    videoSource: VideoSource,
    name: string,
    description: string
  ): Blueprint {
    const nodes = this.createNodes(skills);
    const edges = this.createEdges(skills, nodes);
    const layoutNodes = this.layoutNodes(nodes, edges);

    return {
      id: this.generateId(),
      name,
      description,
      videoSource,
      skills,
      nodes: layoutNodes,
      edges,
      artifacts: [],
      marketingAssets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
    };
  }

  // Create DAG nodes from skills
  private createNodes(skills: Skill[]): DAGNode[] {
    return skills.map(skill => ({
      id: `node_${skill.id}`,
      skillId: skill.id,
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        label: skill.name,
        status: skill.status,
        type: skill.type,
      },
    }));
  }

  // Create DAG edges from skill dependencies
  private createEdges(skills: Skill[], nodes: DAGNode[]): DAGEdge[] {
    const edges: DAGEdge[] = [];
    const skillToNode = new Map(nodes.map(n => [n.skillId, n.id]));

    for (const skill of skills) {
      for (const depId of skill.dependsOn) {
        const sourceNodeId = skillToNode.get(depId);
        const targetNodeId = skillToNode.get(skill.id);

        if (sourceNodeId && targetNodeId) {
          edges.push({
            id: `edge_${sourceNodeId}_${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            animated: skill.status === 'running',
          });
        }
      }
    }

    return edges;
  }

  // Layout nodes using a layered approach (Sugiyama-style)
  private layoutNodes(nodes: DAGNode[], edges: DAGEdge[]): DAGNode[] {
    // Build adjacency for layer assignment
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();

    for (const node of nodes) {
      outgoing.set(node.id, []);
      incoming.set(node.id, []);
    }

    for (const edge of edges) {
      outgoing.get(edge.source)?.push(edge.target);
      incoming.get(edge.target)?.push(edge.source);
    }

    // Assign layers using longest path
    const layers = new Map<string, number>();
    const visited = new Set<string>();

    const assignLayer = (nodeId: string): number => {
      if (layers.has(nodeId)) {
        return layers.get(nodeId)!;
      }

      if (visited.has(nodeId)) {
        return 0; // Cycle detected, break it
      }

      visited.add(nodeId);
      const deps = incoming.get(nodeId) || [];

      let maxDepLayer = -1;
      for (const dep of deps) {
        maxDepLayer = Math.max(maxDepLayer, assignLayer(dep));
      }

      const layer = maxDepLayer + 1;
      layers.set(nodeId, layer);
      visited.delete(nodeId);

      return layer;
    };

    for (const node of nodes) {
      assignLayer(node.id);
    }

    // Group nodes by layer
    const layerGroups = new Map<number, DAGNode[]>();
    for (const node of nodes) {
      const layer = layers.get(node.id) || 0;
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(node);
    }

    // Position nodes
    const NODE_WIDTH = 200;
    const NODE_HEIGHT = 80;
    const LAYER_GAP = 150;
    const NODE_GAP = 100;

    Array.from(layerGroups.entries()).forEach(([layer, layerNodes]) => {
      const layerWidth = layerNodes.length * (NODE_WIDTH + NODE_GAP) - NODE_GAP;
      const startX = -layerWidth / 2;

      layerNodes.forEach((node, index) => {
        node.position = {
          x: startX + index * (NODE_WIDTH + NODE_GAP),
          y: layer * (NODE_HEIGHT + LAYER_GAP),
        };
      });
    });

    return nodes;
  }

  // Validate the DAG (check for cycles, orphans, etc.)
  validateDAG(blueprint: Blueprint): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check for cycles
    if (this.hasCycle(blueprint)) {
      issues.push({
        type: 'error',
        message: 'DAG contains a cycle',
        nodeIds: this.findCycleNodes(blueprint),
      });
    }

    // Check for orphan nodes (no incoming or outgoing edges, except start/end)
    const orphans = this.findOrphans(blueprint);
    if (orphans.length > 0) {
      issues.push({
        type: 'warning',
        message: 'DAG contains orphan nodes',
        nodeIds: orphans,
      });
    }

    // Check for unreachable nodes
    const unreachable = this.findUnreachable(blueprint);
    if (unreachable.length > 0) {
      issues.push({
        type: 'warning',
        message: 'Some nodes are unreachable from start',
        nodeIds: unreachable,
      });
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues,
    };
  }

  // Check if DAG has a cycle
  private hasCycle(blueprint: Blueprint): boolean {
    const adjacency = new Map<string, string[]>();
    for (const node of blueprint.nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of blueprint.edges) {
      adjacency.get(edge.source)?.push(edge.target);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of blueprint.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  // Find nodes involved in cycles
  private findCycleNodes(blueprint: Blueprint): string[] {
    // Simplified - return empty for now
    return [];
  }

  // Find orphan nodes
  private findOrphans(blueprint: Blueprint): string[] {
    const hasIncoming = new Set<string>();
    const hasOutgoing = new Set<string>();

    for (const edge of blueprint.edges) {
      hasOutgoing.add(edge.source);
      hasIncoming.add(edge.target);
    }

    return blueprint.nodes
      .filter(n => !hasIncoming.has(n.id) && !hasOutgoing.has(n.id))
      .map(n => n.id);
  }

  // Find unreachable nodes
  private findUnreachable(blueprint: Blueprint): string[] {
    if (blueprint.nodes.length === 0) return [];

    const adjacency = new Map<string, string[]>();
    for (const node of blueprint.nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of blueprint.edges) {
      adjacency.get(edge.source)?.push(edge.target);
    }

    // Find start nodes (no incoming edges)
    const hasIncoming = new Set(blueprint.edges.map(e => e.target));
    const startNodes = blueprint.nodes.filter(n => !hasIncoming.has(n.id));

    // BFS from all start nodes
    const reachable = new Set<string>();
    const queue = startNodes.map(n => n.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      for (const neighbor of adjacency.get(current) || []) {
        if (!reachable.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return blueprint.nodes.filter(n => !reachable.has(n.id)).map(n => n.id);
  }

  // Optimize DAG by removing redundant edges
  optimizeDAG(blueprint: Blueprint): Blueprint {
    // Transitive reduction
    const reachable = new Map<string, Set<string>>();

    // Build transitive closure
    for (const node of blueprint.nodes) {
      reachable.set(node.id, new Set());
    }

    // Floyd-Warshall style
    for (const edge of blueprint.edges) {
      reachable.get(edge.source)?.add(edge.target);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const [source, targets] of reachable) {
        for (const target of targets) {
          for (const indirect of reachable.get(target) || []) {
            if (!targets.has(indirect)) {
              targets.add(indirect);
              changed = true;
            }
          }
        }
      }
    }

    // Remove redundant edges
    const optimizedEdges = blueprint.edges.filter(edge => {
      // Check if there's an alternative path
      const directReach = reachable.get(edge.source);
      if (!directReach) return true;

      for (const intermediate of directReach) {
        if (intermediate !== edge.target) {
          const intermediateReach = reachable.get(intermediate);
          if (intermediateReach?.has(edge.target)) {
            return false; // Redundant edge
          }
        }
      }
      return true;
    });

    return {
      ...blueprint,
      edges: optimizedEdges,
      updatedAt: new Date().toISOString(),
    };
  }

  // Export DAG as various formats
  exportAsJSON(blueprint: Blueprint): string {
    return JSON.stringify(blueprint, null, 2);
  }

  exportAsMermaid(blueprint: Blueprint): string {
    let mermaid = 'graph TD\n';

    for (const node of blueprint.nodes) {
      const skill = blueprint.skills.find(s => s.id === node.skillId);
      const label = skill?.name || node.data.label;
      mermaid += `    ${node.id}["${label}"]\n`;
    }

    for (const edge of blueprint.edges) {
      mermaid += `    ${edge.source} --> ${edge.target}\n`;
    }

    return mermaid;
  }

  exportAsDOT(blueprint: Blueprint): string {
    let dot = 'digraph Blueprint {\n';
    dot += '    rankdir=TB;\n';
    dot += '    node [shape=box];\n\n';

    for (const node of blueprint.nodes) {
      const skill = blueprint.skills.find(s => s.id === node.skillId);
      const label = skill?.name || node.data.label;
      dot += `    "${node.id}" [label="${label}"];\n`;
    }

    dot += '\n';

    for (const edge of blueprint.edges) {
      dot += `    "${edge.source}" -> "${edge.target}";\n`;
    }

    dot += '}\n';
    return dot;
  }
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  nodeIds?: string[];
}

// Singleton instance
export const dagBuilder = new DAGBuilder();
