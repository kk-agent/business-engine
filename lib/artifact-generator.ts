// Artifact Generator - Creates deployable infrastructure artifacts
import { Blueprint, Skill, Artifact, ArtifactType } from './types';

export class ArtifactGenerator {
  private generateId(): string {
    return `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // Generate all artifacts for a blueprint
  async generateArtifacts(
    blueprint: Blueprint,
    types: ArtifactType[]
  ): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    for (const type of types) {
      const artifact = await this.generateArtifact(blueprint, type);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  // Generate a single artifact
  private async generateArtifact(
    blueprint: Blueprint,
    type: ArtifactType
  ): Promise<Artifact | null> {
    switch (type) {
      case 'dockerfile':
        return this.generateDockerfile(blueprint);
      case 'docker_compose':
        return this.generateDockerCompose(blueprint);
      case 'github_actions':
        return this.generateGitHubActions(blueprint);
      case 'gitlab_ci':
        return this.generateGitLabCI(blueprint);
      case 'openapi_spec':
        return this.generateOpenAPI(blueprint);
      case 'kubernetes_manifest':
        return this.generateKubernetes(blueprint);
      case 'terraform':
        return this.generateTerraform(blueprint);
      case 'python_script':
        return this.generatePythonScript(blueprint);
      case 'bash_script':
        return this.generateBashScript(blueprint);
      default:
        return null;
    }
  }

  // Generate Dockerfile
  private generateDockerfile(blueprint: Blueprint): Artifact {
    const dockerSkills = blueprint.skills.filter(
      s => s.type === 'docker_run' || s.type === 'deployment'
    );

    const content = `# Auto-generated Dockerfile for ${blueprint.name}
# Generated: ${new Date().toISOString()}
# Source: ${blueprint.videoSource?.url || 'N/A'}

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

# Skill configurations embedded as labels
${dockerSkills.map(s => `LABEL skill.${s.id}="${s.name}"`).join('\n')}
`;

    return {
      id: this.generateId(),
      type: 'dockerfile',
      name: 'Dockerfile',
      content,
      skillId: dockerSkills[0]?.id || '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate Docker Compose
  private generateDockerCompose(blueprint: Blueprint): Artifact {
    const services = blueprint.skills
      .filter(s => s.type === 'docker_run' || s.type === 'api_call')
      .map(s => this.skillToService(s));

    const content = `# Auto-generated docker-compose.yml for ${blueprint.name}
# Generated: ${new Date().toISOString()}

version: '3.8'

services:
  # Main application service
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
    depends_on:
      - redis
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis for caching and queues
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

${services.map(s => `  # Service for skill: ${s.name}
  ${s.serviceName}:
    image: ${s.image}
    environment:
${s.env.map(e => `      - ${e}`).join('\n')}
    networks:
      - app-network
    restart: unless-stopped
`).join('\n')}

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
`;

    return {
      id: this.generateId(),
      type: 'docker_compose',
      name: 'docker-compose.yml',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Convert skill to Docker service config
  private skillToService(skill: Skill): ServiceConfig {
    const serviceName = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      name: skill.name,
      serviceName,
      image: `${serviceName}:latest`,
      env: [
        `SKILL_ID=${skill.id}`,
        `SKILL_TYPE=${skill.type}`,
      ],
    };
  }

  // Generate GitHub Actions workflow
  private generateGitHubActions(blueprint: Blueprint): Artifact {
    const content = `# Auto-generated GitHub Actions workflow for ${blueprint.name}
# Generated: ${new Date().toISOString()}

name: CI/CD Pipeline - ${blueprint.name}

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  build:
    needs: [lint-and-test, security-scan]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add your staging deployment commands here

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add your production deployment commands here

      - name: Notify on success
        if: success()
        run: |
          echo "Deployment successful!"

# Skills executed in this pipeline:
${blueprint.skills.map(s => `# - ${s.name} (${s.type})`).join('\n')}
`;

    return {
      id: this.generateId(),
      type: 'github_actions',
      name: '.github/workflows/ci-cd.yml',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate GitLab CI
  private generateGitLabCI(blueprint: Blueprint): Artifact {
    const content = `# Auto-generated GitLab CI pipeline for ${blueprint.name}
# Generated: ${new Date().toISOString()}

stages:
  - test
  - build
  - security
  - deploy

variables:
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

# Cache node_modules between jobs
.node-cache: &node-cache
  cache:
    key: \${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

lint:
  stage: test
  image: node:20-alpine
  <<: *node-cache
  script:
    - npm ci
    - npm run lint
    - npm run type-check

test:
  stage: test
  image: node:20-alpine
  <<: *node-cache
  script:
    - npm ci
    - npm run test -- --coverage
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
  only:
    - main
    - develop

security-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity HIGH,CRITICAL $IMAGE_TAG
  allow_failure: true

deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - echo "Deploying to staging..."
  only:
    - develop

deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  script:
    - echo "Deploying to production..."
  only:
    - main
  when: manual
`;

    return {
      id: this.generateId(),
      type: 'gitlab_ci',
      name: '.gitlab-ci.yml',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate OpenAPI spec
  private generateOpenAPI(blueprint: Blueprint): Artifact {
    const apiSkills = blueprint.skills.filter(s => s.type === 'api_call');

    const paths: Record<string, object> = {};

    for (const skill of apiSkills) {
      const pathName = `/${skill.name.replace(/_/g, '-')}`;
      paths[pathName] = {
        get: {
          summary: skill.description,
          operationId: skill.id,
          tags: skill.tags,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      };
    }

    const spec = {
      openapi: '3.0.3',
      info: {
        title: `${blueprint.name} API`,
        description: `Auto-generated API specification for ${blueprint.name}`,
        version: '1.0.0',
        contact: {
          name: 'API Support',
        },
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' },
        { url: 'https://api.example.com', description: 'Production' },
      ],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    };

    return {
      id: this.generateId(),
      type: 'openapi_spec',
      name: 'openapi.yaml',
      content: JSON.stringify(spec, null, 2),
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate Kubernetes manifests
  private generateKubernetes(blueprint: Blueprint): Artifact {
    const content = `# Auto-generated Kubernetes manifests for ${blueprint.name}
# Generated: ${new Date().toISOString()}

---
apiVersion: v1
kind: Namespace
metadata:
  name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  namespace: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  template:
    metadata:
      labels:
        app: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
    spec:
      containers:
        - name: app
          image: ghcr.io/your-org/${blueprint.name.toLowerCase()}:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-service
  namespace: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
spec:
  selector:
    app: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-ingress
  namespace: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - ${blueprint.name.toLowerCase()}.example.com
      secretName: ${blueprint.name.toLowerCase()}-tls
  rules:
    - host: ${blueprint.name.toLowerCase()}.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-service
                port:
                  number: 80

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-hpa
  namespace: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
`;

    return {
      id: this.generateId(),
      type: 'kubernetes_manifest',
      name: 'k8s/deployment.yaml',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate Terraform
  private generateTerraform(blueprint: Blueprint): Artifact {
    const content = `# Auto-generated Terraform configuration for ${blueprint.name}
# Generated: ${new Date().toISOString()}

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "terraform-state-${blueprint.name.toLowerCase()}"
    key    = "state/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

# ECS Cluster
resource "aws_ecs_cluster" "${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_cluster" {
  name = "${blueprint.name.toLowerCase()}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${blueprint.name}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Task Definition
resource "aws_ecs_task_definition" "${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_task" {
  family                   = "${blueprint.name.toLowerCase()}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "${blueprint.name.toLowerCase()}"
      image = "ghcr.io/your-org/${blueprint.name.toLowerCase()}:latest"

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${blueprint.name.toLowerCase()}"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --spider http://localhost:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# IAM Roles
resource "aws_iam_role" "ecs_execution_role" {
  name = "${blueprint.name.toLowerCase()}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${blueprint.name.toLowerCase()}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_logs" {
  name              = "/ecs/${blueprint.name.toLowerCase()}"
  retention_in_days = 30
}

output "cluster_name" {
  value = aws_ecs_cluster.${blueprint.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_cluster.name
}
`;

    return {
      id: this.generateId(),
      type: 'terraform',
      name: 'terraform/main.tf',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate Python script
  private generatePythonScript(blueprint: Blueprint): Artifact {
    const content = `#!/usr/bin/env python3
"""
Auto-generated pipeline runner for ${blueprint.name}
Generated: ${new Date().toISOString()}
Source: ${blueprint.videoSource?.url || 'N/A'}
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class SkillStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Skill:
    id: str
    name: str
    description: str
    skill_type: str
    depends_on: List[str]
    status: SkillStatus = SkillStatus.PENDING
    output: Optional[str] = None


@dataclass
class ExecutionResult:
    skill_id: str
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0


class PipelineRunner:
    def __init__(self, blueprint_id: str):
        self.blueprint_id = blueprint_id
        self.skills: List[Skill] = []
        self.results: List[ExecutionResult] = []
        self.logs: List[Dict[str, Any]] = []

    def load_skills(self):
        """Load skills from the blueprint JSON."""
        # Skills extracted from blueprint
        self.skills = [
${blueprint.skills.map(s => `            Skill(
                id="${s.id}",
                name="${s.name}",
                description="${s.description.replace(/"/g, '\\"').substring(0, 100)}",
                skill_type="${s.type}",
                depends_on=${JSON.stringify(s.dependsOn)},
            ),`).join('\n')}
        ]
        logger.info(f"Loaded {len(self.skills)} skills")

    def get_execution_order(self) -> List[Skill]:
        """Topological sort to get execution order."""
        skill_map = {s.id: s for s in self.skills}
        in_degree = {s.id: 0 for s in self.skills}

        for skill in self.skills:
            for dep in skill.depends_on:
                if dep in in_degree:
                    in_degree[skill.id] += 1

        queue = [s for s in self.skills if in_degree[s.id] == 0]
        result = []

        while queue:
            current = queue.pop(0)
            result.append(current)

            for skill in self.skills:
                if current.id in skill.depends_on:
                    in_degree[skill.id] -= 1
                    if in_degree[skill.id] == 0:
                        queue.append(skill)

        return result

    async def execute_skill(self, skill: Skill) -> ExecutionResult:
        """Execute a single skill."""
        start_time = datetime.now()
        skill.status = SkillStatus.RUNNING

        try:
            logger.info(f"Executing skill: {skill.name}")

            # Skill execution logic based on type
            if skill.skill_type == "docker_run":
                output = await self._execute_docker(skill)
            elif skill.skill_type == "api_call":
                output = await self._execute_api(skill)
            elif skill.skill_type == "script_execution":
                output = await self._execute_script(skill)
            else:
                output = await self._execute_generic(skill)

            skill.status = SkillStatus.COMPLETED
            skill.output = output

            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            return ExecutionResult(
                skill_id=skill.id,
                success=True,
                output=output,
                duration_ms=duration
            )

        except Exception as e:
            skill.status = SkillStatus.FAILED
            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            return ExecutionResult(
                skill_id=skill.id,
                success=False,
                error=str(e),
                duration_ms=duration
            )

    async def _execute_docker(self, skill: Skill) -> str:
        """Execute Docker-related skill."""
        logger.info(f"[Docker] {skill.name}")
        await asyncio.sleep(0.1)  # Simulate execution
        return f"Docker container started for {skill.name}"

    async def _execute_api(self, skill: Skill) -> str:
        """Execute API call skill."""
        logger.info(f"[API] {skill.name}")
        await asyncio.sleep(0.1)
        return f"API call completed for {skill.name}"

    async def _execute_script(self, skill: Skill) -> str:
        """Execute script skill."""
        logger.info(f"[Script] {skill.name}")
        await asyncio.sleep(0.1)
        return f"Script executed for {skill.name}"

    async def _execute_generic(self, skill: Skill) -> str:
        """Execute generic skill."""
        logger.info(f"[Generic] {skill.name}")
        await asyncio.sleep(0.1)
        return f"Completed {skill.name}"

    async def run(self, dry_run: bool = False, skip_skills: List[str] = None):
        """Run the entire pipeline."""
        skip_skills = skip_skills or []

        logger.info(f"Starting pipeline execution for blueprint: {self.blueprint_id}")
        self.load_skills()

        ordered_skills = self.get_execution_order()
        logger.info(f"Execution order: {[s.name for s in ordered_skills]}")

        for skill in ordered_skills:
            if skill.id in skip_skills:
                logger.info(f"Skipping skill: {skill.name}")
                skill.status = SkillStatus.SKIPPED
                continue

            if dry_run:
                logger.info(f"[DRY RUN] Would execute: {skill.name}")
                continue

            result = await self.execute_skill(skill)
            self.results.append(result)

            if not result.success:
                logger.error(f"Skill failed: {skill.name} - {result.error}")
                break

        # Summary
        completed = sum(1 for r in self.results if r.success)
        failed = sum(1 for r in self.results if not r.success)
        logger.info(f"Pipeline complete: {completed} succeeded, {failed} failed")

        return self.results


async def main():
    runner = PipelineRunner("${blueprint.id}")
    results = await runner.run(dry_run=False)

    print("\\n" + "="*50)
    print("EXECUTION RESULTS")
    print("="*50)
    for result in results:
        status = "✓" if result.success else "✗"
        print(f"{status} {result.skill_id}: {result.output or result.error}")


if __name__ == "__main__":
    asyncio.run(main())
`;

    return {
      id: this.generateId(),
      type: 'python_script',
      name: 'run_pipeline.py',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate Bash script
  private generateBashScript(blueprint: Blueprint): Artifact {
    const content = `#!/bin/bash
# Auto-generated pipeline runner for ${blueprint.name}
# Generated: ${new Date().toISOString()}
# Source: ${blueprint.videoSource?.url || 'N/A'}

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging functions
log_info() { echo -e "\${BLUE}[INFO]\${NC} $1"; }
log_success() { echo -e "\${GREEN}[SUCCESS]\${NC} $1"; }
log_warn() { echo -e "\${YELLOW}[WARN]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }

# Configuration
BLUEPRINT_ID="${blueprint.id}"
BLUEPRINT_NAME="${blueprint.name}"
DRY_RUN=false
SKIP_SKILLS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip)
            SKIP_SKILLS="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info "Starting pipeline: $BLUEPRINT_NAME"
log_info "Blueprint ID: $BLUEPRINT_ID"

if [ "$DRY_RUN" = true ]; then
    log_warn "Running in DRY RUN mode - no actual changes will be made"
fi

# Track execution status
TOTAL_SKILLS=0
COMPLETED_SKILLS=0
FAILED_SKILLS=0
SKIPPED_SKILLS=0

# Execute skill function
execute_skill() {
    local skill_id="$1"
    local skill_name="$2"
    local skill_type="$3"

    ((TOTAL_SKILLS++))

    # Check if skill should be skipped
    if [[ "$SKIP_SKILLS" == *"$skill_id"* ]]; then
        log_warn "Skipping skill: $skill_name"
        ((SKIPPED_SKILLS++))
        return 0
    fi

    log_info "Executing skill: $skill_name ($skill_type)"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would execute: $skill_name"
        ((COMPLETED_SKILLS++))
        return 0
    fi

    # Execute based on type
    case $skill_type in
        docker_run)
            log_info "Running Docker command..."
            # docker run commands here
            ;;
        api_call)
            log_info "Making API call..."
            # curl/wget commands here
            ;;
        script_execution)
            log_info "Running script..."
            # Script execution here
            ;;
        *)
            log_info "Running generic task..."
            ;;
    esac

    if [ $? -eq 0 ]; then
        log_success "Completed: $skill_name"
        ((COMPLETED_SKILLS++))
    else
        log_error "Failed: $skill_name"
        ((FAILED_SKILLS++))
        return 1
    fi
}

# Execute skills in order
log_info "="*50
log_info "EXECUTING SKILLS"
log_info "="*50

${blueprint.skills.map(s => `execute_skill "${s.id}" "${s.name}" "${s.type}"`).join('\n')}

# Summary
echo ""
log_info "="*50
log_info "EXECUTION SUMMARY"
log_info "="*50
log_info "Total skills: $TOTAL_SKILLS"
log_success "Completed: $COMPLETED_SKILLS"
log_error "Failed: $FAILED_SKILLS"
log_warn "Skipped: $SKIPPED_SKILLS"

if [ $FAILED_SKILLS -gt 0 ]; then
    log_error "Pipeline completed with failures"
    exit 1
else
    log_success "Pipeline completed successfully"
    exit 0
fi
`;

    return {
      id: this.generateId(),
      type: 'bash_script',
      name: 'run_pipeline.sh',
      content,
      skillId: '',
      generatedAt: new Date().toISOString(),
    };
  }
}

interface ServiceConfig {
  name: string;
  serviceName: string;
  image: string;
  env: string[];
}

// Singleton instance
export const artifactGenerator = new ArtifactGenerator();
