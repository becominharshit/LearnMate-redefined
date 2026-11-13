/**
 * Reproducible Concurrency & Latency Benchmark for LearnMate JEE Server
 *
 * Usage:
 *   BENCHMARK_URL=http://127.0.0.1:3000 npx tsx scripts/benchmarkConcurrency.ts
 */

interface RequestSample {
  endpoint: string;
  status: number;
  latencyMs: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

async function runBatch(
  baseUrl: string,
  endpoint: string,
  method: 'GET' | 'POST',
  body: unknown,
  concurrency: number,
  totalRequests: number
): Promise<{
  endpoint: string;
  totalRequests: number;
  concurrency: number;
  durationMs: number;
  rps: number;
  statusCounts: Record<number, number>;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}> {
  const samples: RequestSample[] = [];
  let cursor = 0;
  const batchStart = performance.now();

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= totalRequests) break;
      const t0 = performance.now();
      let status = 0;
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method,
          headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'POST' ? JSON.stringify(body) : undefined,
        });
        status = res.status;
        await res.arrayBuffer();
      } catch {
        status = 0;
      }
      samples.push({
        endpoint,
        status,
        latencyMs: performance.now() - t0,
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durationMs = Number((performance.now() - batchStart).toFixed(2));
  const sortedLatencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const statusCounts: Record<number, number> = {};
  for (const s of samples) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  return {
    endpoint,
    totalRequests,
    concurrency,
    durationMs,
    rps: Number(((totalRequests / Math.max(1, durationMs)) * 1000).toFixed(1)),
    statusCounts,
    p50Ms: percentile(sortedLatencies, 50),
    p95Ms: percentile(sortedLatencies, 95),
    p99Ms: percentile(sortedLatencies, 99),
    maxMs: Number((sortedLatencies[sortedLatencies.length - 1] || 0).toFixed(2)),
  };
}

async function main() {
  const baseUrl = (process.env.BENCHMARK_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const results = [];

  results.push(await runBatch(baseUrl, '/api/health', 'GET', undefined, 20, 120));
  results.push(await runBatch(baseUrl, '/api/pyq/provenance', 'GET', undefined, 16, 80));
  results.push(await runBatch(baseUrl, '/api/pyq/questions?limit=15', 'GET', undefined, 16, 80));
  results.push(
    await runBatch(
      baseUrl,
      '/api/cbt/grade',
      'POST',
      {
        paperId: 'paper-jee-main-2027-editorial-mock-1',
        shiftDifficulty: 'Moderate',
        responses: [],
      },
      12,
      60
    )
  );
  results.push(await runBatch(baseUrl, '/api/commercial/tiers', 'GET', undefined, 12, 60));

  console.log(JSON.stringify({ baseUrl, measuredAt: new Date().toISOString(), results }, null, 2));
}

void main();
