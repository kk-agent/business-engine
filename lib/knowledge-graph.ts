// Knowledge Graph - Persistent storage and querying for blueprints and skills
import {
  KnowledgeGraph,
  Blueprint,
  Skill,
  GraphRelationship,
  VideoSource,
} from './types';

import { loadGraph, saveGraph } from './persistence';

const emptyGraph = (): KnowledgeGraph => ({
  id: 'default_graph',
  blueprints: [],
  skills: [],
  relationships: [],
  tags: [],
  metadata: {},
  lastUpdated: new Date().toISOString(),
});

let graphStore: KnowledgeGraph = emptyGraph();
let graphLoaded = false;

export class KnowledgeGraphManager {
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async ensureLoaded(): Promise<void> {
    if (graphLoaded) {
      return;
    }
    graphStore = await loadGraph(emptyGraph());
    graphLoaded = true;
  }

  // Initialize or load the knowledge graph
  async initialize(): Promise<KnowledgeGraph> {
    await this.ensureLoaded();
    return graphStore;
  }

  // Save the knowledge graph
  async save(): Promise<void> {
    graphStore.lastUpdated = new Date().toISOString();
    await saveGraph(graphStore);
  }

  // Store a blueprint
  async storeBlueprint(blueprint: Blueprint): Promise<void> {
    await this.ensureLoaded();
    // Remove existing blueprint with same ID
    graphStore.blueprints = graphStore.blueprints.filter(b => b.id !== blueprint.id);

    // Add new blueprint
    graphStore.blueprints.push(blueprint);

    // Index skills
    for (const skill of blueprint.skills) {
      await this.indexSkill(skill, blueprint.id);
    }

    // Update tags
    this.updateTags(blueprint);

    // Create relationships
    await this.createRelationships(blueprint);

    await this.save();
  }

  // Index a skill for searching
  private async indexSkill(skill: Skill, blueprintId: string): Promise<void> {
    // Check if skill already exists
    const existingIndex = graphStore.skills.findIndex(s => s.id === skill.id);

    if (existingIndex >= 0) {
      graphStore.skills[existingIndex] = skill;
    } else {
      graphStore.skills.push(skill);
    }
  }

  // Update tag index
  private updateTags(blueprint: Blueprint): void {
    const allTags = new Set(graphStore.tags);

    for (const skill of blueprint.skills) {
      for (const tag of skill.tags) {
        allTags.add(tag);
      }
    }

    graphStore.tags = Array.from(allTags);
  }

  // Create relationships between skills
  private async createRelationships(blueprint: Blueprint): Promise<void> {
    // Create dependency relationships
    for (const skill of blueprint.skills) {
      for (const depId of skill.dependsOn) {
        const relationship: GraphRelationship = {
          sourceId: depId,
          targetId: skill.id,
          type: 'depends_on',
          weight: 1.0,
        };

        // Avoid duplicates
        const exists = graphStore.relationships.some(
          r => r.sourceId === relationship.sourceId &&
               r.targetId === relationship.targetId &&
               r.type === relationship.type
        );

        if (!exists) {
          graphStore.relationships.push(relationship);
        }
      }
    }

    // Find similar skills and create "alternative_to" relationships
    await this.findSimilarSkills(blueprint);
  }

  // Find similar skills across blueprints
  private async findSimilarSkills(blueprint: Blueprint): Promise<void> {
    for (const skill of blueprint.skills) {
      for (const existingSkill of graphStore.skills) {
        if (skill.id === existingSkill.id) continue;

        const similarity = this.calculateSimilarity(skill, existingSkill);

        if (similarity > 0.7) {
          const relationship: GraphRelationship = {
            sourceId: skill.id,
            targetId: existingSkill.id,
            type: 'alternative_to',
            weight: similarity,
          };

          const exists = graphStore.relationships.some(
            r => r.sourceId === relationship.sourceId &&
                 r.targetId === relationship.targetId &&
                 r.type === relationship.type
          );

          if (!exists) {
            graphStore.relationships.push(relationship);
          }
        }
      }
    }
  }

  // Calculate similarity between skills (simple implementation)
  private calculateSimilarity(skill1: Skill, skill2: Skill): number {
    let score = 0;

    // Same type
    if (skill1.type === skill2.type) score += 0.3;

    // Overlapping tags
    const tags1 = new Set(skill1.tags);
    const tags2 = new Set(skill2.tags);
    const intersection = Array.from(tags1).filter(t => tags2.has(t));
    const union = new Set(Array.from(tags1).concat(Array.from(tags2)));
    score += (intersection.length / union.size) * 0.4;

    // Similar names (Jaccard on words)
    const words1 = new Set(skill1.name.toLowerCase().split('_'));
    const words2 = new Set(skill2.name.toLowerCase().split('_'));
    const wordIntersection = Array.from(words1).filter(w => words2.has(w));
    const wordUnion = new Set(Array.from(words1).concat(Array.from(words2)));
    score += (wordIntersection.length / wordUnion.size) * 0.3;

    return score;
  }

  // Query blueprints
  async queryBlueprints(query: BlueprintQuery): Promise<Blueprint[]> {
    await this.ensureLoaded();
    let results = [...graphStore.blueprints];

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(b =>
        b.skills.some(s =>
          s.tags.some(t => query.tags!.includes(t))
        )
      );
    }

    // Filter by skill type
    if (query.skillTypes && query.skillTypes.length > 0) {
      results = results.filter(b =>
        b.skills.some(s => query.skillTypes!.includes(s.type))
      );
    }

    // Filter by status
    if (query.status) {
      results = results.filter(b => b.status === query.status);
    }

    // Filter by date range
    if (query.createdAfter) {
      results = results.filter(b =>
        new Date(b.createdAt) >= new Date(query.createdAfter!)
      );
    }

    if (query.createdBefore) {
      results = results.filter(b =>
        new Date(b.createdAt) <= new Date(query.createdBefore!)
      );
    }

    // Text search
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(b =>
        b.name.toLowerCase().includes(searchLower) ||
        b.description.toLowerCase().includes(searchLower) ||
        b.skills.some(s =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower)
        )
      );
    }

    // Sort
    if (query.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;
        switch (query.sortBy) {
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'updatedAt':
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'skillCount':
            comparison = a.skills.length - b.skills.length;
            break;
        }
        return query.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // Query skills
  async querySkills(query: SkillQuery): Promise<Skill[]> {
    let results = [...graphStore.skills];

    // Filter by type
    if (query.types && query.types.length > 0) {
      results = results.filter(s => query.types!.includes(s.type));
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(s =>
        s.tags.some(t => query.tags!.includes(t))
      );
    }

    // Filter by complexity
    if (query.complexity) {
      results = results.filter(s => s.complexity === query.complexity);
    }

    // Filter by dependency
    if (query.dependsOn) {
      results = results.filter(s => s.dependsOn.includes(query.dependsOn!));
    }

    // Text search
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  // Find related skills
  async findRelatedSkills(skillId: string): Promise<RelatedSkill[]> {
    const related: RelatedSkill[] = [];

    // Find direct relationships
    for (const rel of graphStore.relationships) {
      if (rel.sourceId === skillId) {
        const skill = graphStore.skills.find(s => s.id === rel.targetId);
        if (skill) {
          related.push({
            skill,
            relationshipType: rel.type,
            weight: rel.weight,
          });
        }
      }
      if (rel.targetId === skillId) {
        const skill = graphStore.skills.find(s => s.id === rel.sourceId);
        if (skill) {
          related.push({
            skill,
            relationshipType: rel.type,
            weight: rel.weight,
          });
        }
      }
    }

    // Sort by weight
    related.sort((a, b) => b.weight - a.weight);

    return related;
  }

  // Get skill usage statistics
  async getSkillStats(): Promise<SkillStats> {
    const stats: SkillStats = {
      totalSkills: graphStore.skills.length,
      totalBlueprints: graphStore.blueprints.length,
      skillsByType: {},
      skillsByComplexity: { low: 0, medium: 0, high: 0 },
      topTags: [],
      recentActivity: [],
    };

    // Count by type
    for (const skill of graphStore.skills) {
      stats.skillsByType[skill.type] = (stats.skillsByType[skill.type] || 0) + 1;
      if (skill.complexity) {
        stats.skillsByComplexity[skill.complexity]++;
      }
    }

    // Count tags
    const tagCounts: Record<string, number> = {};
    for (const skill of graphStore.skills) {
      for (const tag of skill.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    stats.topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Recent activity
    stats.recentActivity = graphStore.blueprints
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(b => ({
        blueprintId: b.id,
        blueprintName: b.name,
        action: b.createdAt === b.updatedAt ? 'created' : 'updated',
        timestamp: b.updatedAt,
      }));

    return stats;
  }

  // Export the knowledge graph
  async exportGraph(): Promise<string> {
    return JSON.stringify(graphStore, null, 2);
  }

  // Import a knowledge graph
  async importGraph(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data) as KnowledgeGraph;
      graphStore = imported;
      await this.save();
    } catch (error) {
      throw new Error(`Failed to import knowledge graph: ${error}`);
    }
  }

  // Get blueprint by ID
  async getBlueprintById(id: string): Promise<Blueprint | null> {
    await this.ensureLoaded();
    return graphStore.blueprints.find(b => b.id === id) || null;
  }

  // Delete blueprint
  async deleteBlueprint(id: string): Promise<boolean> {
    const index = graphStore.blueprints.findIndex(b => b.id === id);
    if (index < 0) return false;

    const blueprint = graphStore.blueprints[index];

    // Remove skills
    const skillIds = new Set(blueprint.skills.map(s => s.id));
    graphStore.skills = graphStore.skills.filter(s => !skillIds.has(s.id));

    // Remove relationships
    graphStore.relationships = graphStore.relationships.filter(
      r => !skillIds.has(r.sourceId) && !skillIds.has(r.targetId)
    );

    // Remove blueprint
    graphStore.blueprints.splice(index, 1);

    await this.save();
    return true;
  }

  // Get the full graph state
  getGraph(): KnowledgeGraph {
    return graphStore;
  }
}

// Query interfaces
interface BlueprintQuery {
  tags?: string[];
  skillTypes?: string[];
  status?: Blueprint['status'];
  createdAfter?: string;
  createdBefore?: string;
  searchText?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'skillCount';
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

interface SkillQuery {
  types?: string[];
  tags?: string[];
  complexity?: 'low' | 'medium' | 'high';
  dependsOn?: string;
  searchText?: string;
}

interface RelatedSkill {
  skill: Skill;
  relationshipType: GraphRelationship['type'];
  weight: number;
}

interface SkillStats {
  totalSkills: number;
  totalBlueprints: number;
  skillsByType: Record<string, number>;
  skillsByComplexity: { low: number; medium: number; high: number };
  topTags: { tag: string; count: number }[];
  recentActivity: {
    blueprintId: string;
    blueprintName: string;
    action: string;
    timestamp: string;
  }[];
}

// Singleton instance
export const knowledgeGraph = new KnowledgeGraphManager();
