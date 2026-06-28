// Core Types for the Business Engine Pipeline

export interface VideoSource {
  id: string;
  url: string;
  title: string;
  transcript: string;
  summary: string[];
  extractedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  parameters: SkillParameter[];
  dependsOn: string[];
  tags: string[];
  complexity?: 'low' | 'medium' | 'high';
  status: SkillStatus;
  output?: string;
  estimatedDuration?: number;
  createdAt?: string;
}

export type SkillType =
  | 'docker_run'
  | 'api_call'
  | 'script_execution'
  | 'configuration'
  | 'deployment'
  | 'marketing'
  | 'analysis'
  | 'integration';

export type SkillStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description: string;
}

export interface DAGNode {
  id: string;
  skillId: string;
  position: { x: number; y: number };
  data: {
    label: string;
    status: SkillStatus;
    type: SkillType;
  };
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  videoSource?: VideoSource;
  skills: Skill[];
  nodes: DAGNode[];
  edges: DAGEdge[];
  artifacts: Artifact[];
  marketingAssets: MarketingAsset[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready' | 'executing' | 'completed' | 'failed';
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  content: string;
  skillId?: string;
  generatedAt: string;
}

export type ArtifactType =
  | 'dockerfile'
  | 'docker_compose'
  | 'github_actions'
  | 'gitlab_ci'
  | 'openapi_spec'
  | 'kubernetes_manifest'
  | 'terraform'
  | 'python_script'
  | 'bash_script';

export interface MarketingAsset {
  id: string;
  platform: Platform;
  type: MarketingType;
  content: string;
  metadata?: Record<string, string>;
  hashtags?: string[];
  suggestedPostTime?: string;
  generatedAt: string;
}

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'blog' | 'email';
export type MarketingType = 'post' | 'thread' | 'carousel' | 'video_script' | 'article' | 'newsletter';

export interface KnowledgeGraph {
  id: string;
  blueprints: Blueprint[];
  skills: Skill[];
  relationships: GraphRelationship[];
  tags: string[];
  metadata: Record<string, unknown>;
  lastUpdated: string;
}

export interface GraphRelationship {
  sourceId: string;
  targetId: string;
  type: 'depends_on' | 'enhances' | 'alternative_to' | 'derived_from';
  weight: number;
}

export interface PipelineExecution {
  id: string;
  blueprintId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentSkillId?: string;
  logs: ExecutionLog[];
  results: ExecutionResult[];
}

export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  skillId?: string;
  message: string;
}

export interface ExecutionResult {
  skillId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

// API Request/Response Types
export interface IngestRequest {
  youtubeUrl: string;
}

export interface IngestResponse {
  success: boolean;
  videoSource?: VideoSource;
  error?: string;
}

export interface ExtractRequest {
  videoSourceId: string;
  summary: string[];
}

export interface ExtractResponse {
  success: boolean;
  skills?: Skill[];
  error?: string;
}

export interface DAGRequest {
  skills: Skill[];
  blueprintName: string;
}

export interface DAGResponse {
  success: boolean;
  blueprint?: Blueprint;
  error?: string;
}

export interface ArtifactRequest {
  blueprintId: string;
  artifactTypes: ArtifactType[];
}

export interface ArtifactResponse {
  success: boolean;
  artifacts?: Artifact[];
  error?: string;
}

export interface MarketingRequest {
  blueprintId: string;
  platforms: Platform[];
  types: MarketingType[];
}

export interface MarketingResponse {
  success: boolean;
  assets?: MarketingAsset[];
  error?: string;
}

export interface ExecuteRequest {
  blueprintId: string;
  dryRun?: boolean;
  skipSkills?: string[];
}

export interface ExecuteResponse {
  success: boolean;
  execution?: PipelineExecution;
  error?: string;
}
