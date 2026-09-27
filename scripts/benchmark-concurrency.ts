import dotenv from 'dotenv';
dotenv.config();

import autocannon, { Result } from 'autocannon';
import { PrismaClient } from '@prisma/client';
import { hashProvider } from '../src/shared/providers/hash.provider';
import { sessionService } from '../src/modules/auth/infrastructure/session.service';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
let AUTH_COOKIE = process.env.TEST_AUTH_COOKIE || '';
let AUTH_HEADER = '';

const BENCH_USER_EMAIL = 'bench_user@example.com';
const BENCH_USER_PASSWORD = 'Password123!';

interface BenchmarkScenario {
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  connections: number;
  duration: number; // بالثواني
}

/**
 * Ensures a benchmark test user exists in the local DB and creates a fresh session token.
 */
async function setupBenchmarkAuth(): Promise<void> {
  if (AUTH_COOKIE) {
    console.log('🔑 Using provided TEST_AUTH_COOKIE.');
    return;
  }

  try {
    const prisma = new PrismaClient();
    console.log('🔄 Checking / preparing benchmark test user in database...');

    let user = await prisma.user.findUnique({
      where: { emailNormalized: BENCH_USER_EMAIL.toLowerCase() },
      include: { member: true },
    });

    if (!user) {
      const passwordHash = await hashProvider.hash(BENCH_USER_PASSWORD);
      user = await prisma.user.create({
        data: {
          email: BENCH_USER_EMAIL,
          emailNormalized: BENCH_USER_EMAIL.toLowerCase(),
          passwordHash,
          userType: 'MEMBER',
          status: 'ACTIVE',
          member: {
            create: {
              fullNameEn: 'Benchmark Test User',
              phone: '+201000000099',
              phoneNormalized: '+201000000099',
              country: 'EG',
              yearsOfExperience: '5',
              areasOfExpertise: ['Software Engineering', 'Performance Testing'],
              industriesServed: ['Technology'],
              languages: ['en', 'ar'],
            },
          },
        },
        include: { member: true },
      });
      console.log(`✅ Created test benchmark user: ${BENCH_USER_EMAIL}`);
    }

    const { rawToken } = await sessionService.createSession(user.id, '127.0.0.1', 'Autocannon-Benchmark');
    AUTH_COOKIE = `flh_session=${rawToken}`;
    AUTH_HEADER = `Bearer ${rawToken}`;
    console.log('✅ Generated fresh active session token for benchmark.');

    await prisma.$disconnect();
  } catch (err: unknown) {
    console.warn(
      '⚠️ Could not connect to local DB to generate session automatically:',
      err instanceof Error ? err.message : String(err),
    );
    if (!AUTH_COOKIE) {
      AUTH_COOKIE = 'flh_session=benchmark_placeholder_token';
      AUTH_HEADER = 'Bearer benchmark_placeholder_token';
    }
  }
}

interface ScenarioSummary {
  Scenario: string;
  'Req/Sec (Avg)': number;
  'Latency Avg (ms)': number;
  'p90 (ms)': number;
  'p97.5 (ms)': number;
  'p99 (ms)': number;
  'Errors (Non-2xx)': number;
  Timeouts: number;
}

async function runScenario(scenario: BenchmarkScenario): Promise<ScenarioSummary> {
  console.log(`\n⏳ Running: ${scenario.name} (${scenario.connections} connections, ${scenario.duration}s)...`);

  const headers = {
    'x-benchmark-bypass': 'true',
    ...(scenario.headers || {}),
  };

  const timeoutSeconds = Math.max(10, Math.ceil(scenario.duration) + 10);

  const result: Result = await autocannon({
    url: scenario.url,
    method: scenario.method || 'GET',
    headers,
    body: scenario.body,
    connections: scenario.connections,
    duration: Math.max(1, Math.floor(scenario.duration)),
    timeout: timeoutSeconds,
    pipelining: 1,
  });

  const latency = result.latency as unknown as Record<string, number>;

  return {
    Scenario: scenario.name,
    'Req/Sec (Avg)': Math.round(result.requests.average),
    'Latency Avg (ms)': Math.round(result.latency.average),
    'p90 (ms)': latency.p90,
    'p97.5 (ms)': latency.p97_5,
    'p99 (ms)': result.latency.p99,
    'Errors (Non-2xx)': result.non2xx,
    'Timeouts': result.timeouts,
  };
}

async function startSuite() {
  console.log('====================================================');
  console.log('🚀 Starting IBDL Concurrency & Stress Benchmarks');
  console.log(`🎯 Target Host: ${BASE_URL}`);
  console.log('====================================================');

  await setupBenchmarkAuth();

  const scenarios: BenchmarkScenario[] = [
    {
      name: 'S1: Public Tiers (Hot-Path Read)',
      url: `${BASE_URL}/api/v1/memberships/tiers`,
      method: 'GET',
      connections: 200,
      duration: 15,
    },
    {
      name: 'S2: Member Dashboard (Authenticated Multi-Query)',
      url: `${BASE_URL}/api/v1/members/dashboard`,
      method: 'GET',
      headers: {
        Cookie: AUTH_COOKIE,
        Authorization: AUTH_HEADER,
      },
      connections: 100,
      duration: 15,
    },
    {
      name: 'S3: Auth Login Concurrency (Argon2id & Threadpool)',
      url: `${BASE_URL}/api/v1/auth/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: BENCH_USER_EMAIL,
        password: BENCH_USER_PASSWORD,
      }),
      connections: 30,
      duration: 10,
    },
    {
      name: 'S4: Public Directory Query',
      url: `${BASE_URL}/api/v1/directory?page=1&limit=12`,
      method: 'GET',
      connections: 150,
      duration: 15,
    },
  ];

  const summaryTable = [];

  for (const scenario of scenarios) {
    try {
      const summary = await runScenario(scenario);
      summaryTable.push(summary);
    } catch (err) {
      console.error(`❌ Failed on scenario: ${scenario.name}`, err);
    }
  }

  console.log('\n📊 ================= BENCHMARK FINAL RESULTS ================= 📊\n');
  console.table(summaryTable);
  console.log('================================================================');
}

startSuite();