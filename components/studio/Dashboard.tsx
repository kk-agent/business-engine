'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface UsageInfo {
  tier: 'free' | 'pro';
  ingestsUsed: number;
  ingestsLimit: number;
  ingestsRemaining: number;
}

// Types
interface VideoSource {
  id: string;
  url: string;
  title: string;
  summary: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
  type: string;
  dependsOn: string[];
  tags: string[];
  complexity: 'low' | 'medium' | 'high';
  status: string;
}

interface Blueprint {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  nodes: Array<{ id: string; skillId: string; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string }>;
  artifacts: Array<{ id: string; type: string; name: string; content: string }>;
  marketingAssets: Array<{ id: string; platform: string; type: string; content: string }>;
  status: string;
  createdAt: string;
}

interface PipelineExecution {
  id: string;
  status: string;
  logs: Array<{ timestamp: string; level: string; message: string }>;
  results: Array<{ skillId: string; success: boolean; output?: string; error?: string }>;
}

// Main Component
export default function StudioDashboard() {
  const [activeTab, setActiveTab] = useState<'ingest' | 'skills' | 'dag' | 'artifacts' | 'marketing' | 'execute'>('ingest');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [execution, setExecution] = useState<PipelineExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [blueprintName, setBlueprintName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      const data = await res.json();
      if (data.ok) setUsage(data.usage);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  async function parseApi<T>(res: Response): Promise<T & { success?: boolean; error?: string; upgradeUrl?: string }> {
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `Request failed (${res.status})`;
      setError(res.status === 402 ? `${msg} → ${data.upgradeUrl || '/pricing'}` : msg);
      throw new Error(msg);
    }
    setError(null);
    return data;
  }

  const handleIngest = async () => {
    if (!youtubeUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });
      const data = await parseApi<{ success: boolean; videoSource: VideoSource }>(res);
      if (data.success) {
        setVideoSource(data.videoSource);
        setActiveTab('skills');
        await refreshUsage();
      }
    } catch {
      /* error state set */
    }
    setLoading(false);
  };

  // Extract skills
  const handleExtract = async () => {
    if (!videoSource?.summary) return;
    setLoading(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: videoSource.summary }),
      });
      const data = await res.json();
      if (data.success) {
        setSkills(data.skills);
        setActiveTab('dag');
      }
    } catch (error) {
      console.error('Extract error:', error);
    }
    setLoading(false);
  };

  // Build DAG
  const handleBuildDAG = async () => {
    if (!skills.length || !blueprintName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills,
          blueprintName,
          videoSource,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlueprint(data.blueprint);
        setActiveTab('artifacts');
      }
    } catch (error) {
      console.error('DAG error:', error);
    }
    setLoading(false);
  };

  // Generate artifacts
  const handleGenerateArtifacts = async () => {
    if (!blueprint) return;
    setLoading(true);
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: blueprint.id,
          artifactTypes: ['dockerfile', 'docker_compose', 'github_actions', 'python_script'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlueprint(prev => prev ? { ...prev, artifacts: data.artifacts } : null);
        setActiveTab('marketing');
      }
    } catch (error) {
      console.error('Artifacts error:', error);
    }
    setLoading(false);
  };

  // Generate marketing
  const handleGenerateMarketing = async () => {
    if (!blueprint) return;
    setLoading(true);
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: blueprint.id,
          platforms: ['twitter', 'linkedin'],
          types: ['post', 'thread'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlueprint(prev => prev ? { ...prev, marketingAssets: data.assets } : null);
        setActiveTab('execute');
      }
    } catch (error) {
      console.error('Marketing error:', error);
    }
    setLoading(false);
  };

  // Execute pipeline
  const handleExecute = async (dryRun = false) => {
    if (!blueprint) return;
    setLoading(true);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: blueprint.id,
          dryRun,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExecution(data.execution);
      }
    } catch (error) {
      console.error('Execute error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">BE</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Business Engine</h1>
                <p className="text-sm text-gray-500">Video → Production Pipeline</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {usage && (
                <span className="text-xs text-gray-400">
                  {usage.tier === 'pro'
                    ? 'Pro · unlimited'
                    : `${usage.ingestsRemaining}/${usage.ingestsLimit} ingests left`}
                </span>
              )}
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <span className="badge badge-green">v2.0.0</span>
              {blueprint && (
                <span className="badge badge-blue">{blueprint.skills.length} Skills</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-gray-800 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'ingest', label: '1. Ingest', icon: '📹' },
              { id: 'skills', label: '2. Extract', icon: '🧠' },
              { id: 'dag', label: '3. Build DAG', icon: '🔗' },
              { id: 'artifacts', label: '4. Artifacts', icon: '📦' },
              { id: 'marketing', label: '5. Marketing', icon: '📱' },
              { id: 'execute', label: '6. Execute', icon: '🚀' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="card border-red-500/40 bg-red-950/30 text-red-200 text-sm">{error}</div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Ingest Tab */}
        {activeTab === 'ingest' && (
          <div className="animate-fade-in">
            <div className="card max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Ingest Video Source</h2>
              <p className="text-gray-400 mb-6">
                Enter a YouTube URL to extract and analyze the content. The system will
                generate a structured summary that can be converted into executable skills.
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="input"
                />
                <button
                  onClick={handleIngest}
                  disabled={loading || !youtubeUrl}
                  className="btn btn-primary w-full"
                >
                  {loading ? 'Processing...' : 'Ingest Video'}
                </button>
              </div>
              {videoSource && (
                <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
                  <h3 className="font-semibold text-green-400 mb-2">✓ Video Ingested</h3>
                  <p className="text-sm text-gray-300">{videoSource.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{videoSource.summary.length} summary points extracted</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Extract Skills</h2>
              <button
                onClick={handleExtract}
                disabled={loading || !videoSource}
                className="btn btn-primary"
              >
                {loading ? 'Extracting...' : 'Extract Skills'}
              </button>
            </div>

            {videoSource?.summary && (
              <div className="card mb-6">
                <h3 className="font-semibold mb-4">Summary Points ({videoSource.summary.length})</h3>
                <div className="space-y-2">
                  {videoSource.summary.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                      <span className="badge badge-blue">{i + 1}</span>
                      <span className="text-gray-300">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skills.length > 0 && (
              <div className="grid gap-4">
                <h3 className="font-semibold">Extracted Skills ({skills.length})</h3>
                {skills.map((skill) => (
                  <div key={skill.id} className="card">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-blue-400">{skill.name}</h4>
                      <div className="flex gap-2">
                        <span className={`badge ${
                          skill.complexity === 'low' ? 'badge-green' :
                          skill.complexity === 'medium' ? 'badge-yellow' : 'badge-red'
                        }`}>
                          {skill.complexity}
                        </span>
                        <span className="badge badge-gray">{skill.type}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{skill.description}</p>
                    <div className="flex gap-2 mt-3">
                      {skill.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 bg-gray-800 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DAG Tab */}
        {activeTab === 'dag' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Build Dependency Graph</h2>
              <button
                onClick={handleBuildDAG}
                disabled={loading || !skills.length || !blueprintName}
                className="btn btn-primary"
              >
                {loading ? 'Building...' : 'Build DAG'}
              </button>
            </div>

            <div className="card mb-6">
              <label className="block text-sm font-medium mb-2">Blueprint Name</label>
              <input
                type="text"
                value={blueprintName}
                onChange={(e) => setBlueprintName(e.target.value)}
                placeholder="My Business Engine"
                className="input"
              />
            </div>

            {blueprint && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-semibold mb-4">DAG Visualization</h3>
                  <div className="bg-gray-900 rounded-lg p-6 min-h-[400px] relative overflow-auto">
                    {blueprint.nodes.map((node) => {
                      const skill = blueprint.skills.find(s => s.id === node.skillId);
                      return (
                        <div
                          key={node.id}
                          className="dag-node absolute"
                          style={{
                            left: node.position.x + 250,
                            top: node.position.y + 20,
                          }}
                        >
                          <div className="text-sm font-medium">{skill?.name}</div>
                          <div className="text-xs text-gray-500">{skill?.type}</div>
                        </div>
                      );
                    })}
                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                      {blueprint.edges.map((edge) => {
                        const source = blueprint.nodes.find(n => n.id === edge.source);
                        const target = blueprint.nodes.find(n => n.id === edge.target);
                        if (!source || !target) return null;
                        return (
                          <line
                            key={edge.id}
                            x1={source.position.x + 325}
                            y1={source.position.y + 60}
                            x2={target.position.x + 325}
                            y2={target.position.y + 20}
                            stroke="#3b82f6"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                          />
                        );
                      })}
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                      </defs>
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="card text-center">
                    <div className="text-3xl font-bold text-blue-400">{blueprint.skills.length}</div>
                    <div className="text-sm text-gray-500">Total Skills</div>
                  </div>
                  <div className="card text-center">
                    <div className="text-3xl font-bold text-emerald-400">{blueprint.edges.length}</div>
                    <div className="text-sm text-gray-500">Dependencies</div>
                  </div>
                  <div className="card text-center">
                    <div className="text-3xl font-bold text-yellow-400">
                      {Array.from(new Set(blueprint.skills.map(s => s.type))).length}
                    </div>
                    <div className="text-sm text-gray-500">Skill Types</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Artifacts Tab */}
        {activeTab === 'artifacts' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Generate Artifacts</h2>
              <button
                onClick={handleGenerateArtifacts}
                disabled={loading || !blueprint}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Generate All'}
              </button>
            </div>

            {blueprint?.artifacts && blueprint.artifacts.length > 0 ? (
              <div className="space-y-4">
                {blueprint.artifacts.map((artifact) => (
                  <div key={artifact.id} className="card">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {artifact.type === 'dockerfile' ? '🐳' :
                           artifact.type === 'github_actions' ? '⚙️' :
                           artifact.type === 'python_script' ? '🐍' : '📄'}
                        </span>
                        <div>
                          <h4 className="font-semibold">{artifact.name}</h4>
                          <span className="text-xs text-gray-500">{artifact.type}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(artifact.content)}
                        className="btn btn-secondary text-sm"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="code-block text-xs max-h-64 overflow-auto">
                      {artifact.content.substring(0, 2000)}
                      {artifact.content.length > 2000 && '\n... (truncated)'}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-gray-500">No artifacts generated yet</p>
                <p className="text-sm text-gray-600 mt-2">Click &quot;Generate All&quot; to create deployment artifacts</p>
              </div>
            )}
          </div>
        )}

        {/* Marketing Tab */}
        {activeTab === 'marketing' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Marketing Assets</h2>
              <button
                onClick={handleGenerateMarketing}
                disabled={loading || !blueprint}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Generate Assets'}
              </button>
            </div>

            {blueprint?.marketingAssets && blueprint.marketingAssets.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {blueprint.marketingAssets.map((asset) => (
                  <div key={asset.id} className="card">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">
                        {asset.platform === 'twitter' ? '𝕏' :
                         asset.platform === 'linkedin' ? '💼' :
                         asset.platform === 'instagram' ? '📸' : '📝'}
                      </span>
                      <div>
                        <h4 className="font-semibold capitalize">{asset.platform}</h4>
                        <span className="badge badge-blue">{asset.type}</span>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 max-h-64 overflow-auto">
                      <pre className="text-sm whitespace-pre-wrap text-gray-300">
                        {asset.content.substring(0, 1000)}
                        {asset.content.length > 1000 && '\n... (truncated)'}
                      </pre>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(asset.content)}
                      className="btn btn-secondary text-sm mt-4 w-full"
                    >
                      Copy Content
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-gray-500">No marketing assets generated yet</p>
              </div>
            )}
          </div>
        )}

        {/* Execute Tab */}
        {activeTab === 'execute' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Execute Pipeline</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExecute(true)}
                  disabled={loading || !blueprint}
                  className="btn btn-secondary"
                >
                  {loading ? 'Running...' : 'Dry Run'}
                </button>
                <button
                  onClick={() => handleExecute(false)}
                  disabled={loading || !blueprint}
                  className="btn btn-primary"
                >
                  {loading ? 'Executing...' : '🚀 Execute'}
                </button>
              </div>
            </div>

            {blueprint && (
              <div className="grid gap-4 mb-6">
                <div className="card">
                  <h3 className="font-semibold mb-4">Pipeline Summary</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{blueprint.skills.length}</div>
                      <div className="text-xs text-gray-500">Skills</div>
                    </div>
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-400">{blueprint.artifacts?.length || 0}</div>
                      <div className="text-xs text-gray-500">Artifacts</div>
                    </div>
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-400">{blueprint.marketingAssets?.length || 0}</div>
                      <div className="text-xs text-gray-500">Marketing</div>
                    </div>
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold capitalize">
                        <span className={
                          blueprint.status === 'completed' ? 'text-green-400' :
                          blueprint.status === 'failed' ? 'text-red-400' :
                          'text-yellow-400'
                        }>
                          {blueprint.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">Status</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {execution && (
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Execution Results</h3>
                  <span className={`badge ${
                    execution.status === 'completed' ? 'badge-green' :
                    execution.status === 'failed' ? 'badge-red' : 'badge-yellow'
                  }`}>
                    {execution.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${(execution.results.filter(r => r.success).length / Math.max(execution.results.length, 1)) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {execution.results.filter(r => r.success).length} / {execution.results.length} completed
                  </p>
                </div>

                {/* Results */}
                <div className="space-y-2">
                  {execution.results.map((result, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        result.success ? 'bg-green-900/20' : 'bg-red-900/20'
                      }`}
                    >
                      <span>{result.success ? '✓' : '✗'}</span>
                      <span className="font-mono text-sm">{result.skillId.substring(0, 20)}...</span>
                      <span className="text-gray-400 text-sm flex-1">
                        {result.output || result.error}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Logs */}
                {execution.logs.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">Logs</h4>
                    <div className="code-block max-h-48 overflow-auto">
                      {execution.logs.slice(-20).map((log, i) => (
                        <div key={i} className={`text-xs ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warn' ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          [{log.timestamp.split('T')[1].split('.')[0]}] {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          Business Engine • Video to Production Pipeline • Built with Next.js
        </div>
      </footer>
    </div>
  );
}
