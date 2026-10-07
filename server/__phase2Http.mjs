/**
 * TEMPORARY Phase 2 HTTP verification — run once, then deleted.
 * Exercises the live Express API end to end, including a REAL Gemini call.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const BASE = 'http://localhost:5000/api';
const require = createRequire(import.meta.url);

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const call = async (method, path, { cookie, body, base = BASE, timeoutMs = 30000 } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const setCookie = res.headers.get('set-cookie');
  const data = await res.json().catch(() => null);
  const cookieOut = setCookie ? setCookie.split(';')[0] : cookie;
  return { status: res.status, data, cookie: cookieOut };
};

const profile = {
  goal: 'weight_management',
  experienceLevel: 'intermediate',
  trainingLocation: 'home',
  equipment: ['dumbbells', 'resistance bands'],
  availableDays: ['monday', 'wednesday', 'friday'],
  sessionDuration: 45,
  preferredActivities: ['walking'],
  excludedExercises: ['burpees'],
  sport: 'none',
};

const suffix = Date.now().toString(36);
const emails = [];
const register = async (label, base = BASE) => {
  const email = `phase2-${label}-${suffix}@example.com`;
  emails.push(email);
  const res = await call('POST', '/auth/register', {
    base,
    body: { name: `Phase2 ${label}`, email, password: 'Sup3rSecret!pass' },
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register(${label}) failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.cookie;
};

const main = async () => {
  console.log('\n--- T1: unauthenticated generate ---');
  const unauth = await call('POST', '/plans/generate');
  check('401 without a session cookie', unauth.status === 401, String(unauth.status));

  console.log('\n--- T2: authenticated user with no profile ---');
  const cookieA = await register('a');
  const noProfile = await call('POST', '/plans/generate', { cookie: cookieA });
  check(
    '400 with the "Complete your fitness profile" message',
    noProfile.status === 400 &&
      typeof noProfile.data?.message === 'string' &&
      noProfile.data.message.includes('Complete your fitness profile'),
    `${noProfile.status} ${JSON.stringify(noProfile.data)}`,
  );
  const emptyList = await call('GET', '/plans', { cookie: cookieA });
  check('no plan saved when the profile is missing', emptyList.data?.plans?.length === 0);

  console.log('\n--- T3: real Gemini generation (end to end) ---');
  const put = await call('PUT', '/profile', { cookie: cookieA, body: profile });
  check('profile accepted', put.status === 200, `${put.status} ${JSON.stringify(put.data)}`);

  const started = Date.now();
  const generated = await call('POST', '/plans/generate', { cookie: cookieA, timeoutMs: 180000 });
  const elapsed = Date.now() - started;
  const plan = generated.data?.plan;
  check('201 with a saved plan', generated.status === 201 && !!plan, `${generated.status} ${JSON.stringify(generated.data).slice(0, 400)}`);
  if (plan) {
    check('7 days returned', Array.isArray(plan.days) && plan.days.length === 7, String(plan.days?.length));
    check('goal/experienceLevel come from the profile', plan.goal === 'weight_management' && plan.experienceLevel === 'intermediate', `${plan.goal}/${plan.experienceLevel}`);
    check('aiMetadata recorded (model + promptVersion + generatedAt)', !!plan.aiMetadata?.model && plan.aiMetadata?.promptVersion === 'v1' && !!plan.aiMetadata?.generatedAt, JSON.stringify(plan.aiMetadata));
    const trainingDays = plan.days.filter((d) => !d.restDay);
    check('training days have exercises, rest days do not', trainingDays.every((d) => d.exercises.length > 0) && plan.days.filter((d) => d.restDay).every((d) => d.exercises.length === 0));
    check('no excluded exercise leaked in (burpees)', JSON.stringify(plan).toLowerCase().includes('burpee') === false);
    check('every exercise has instructions', trainingDays.every((d) => d.exercises.every((e) => typeof e.instructions === 'string' && e.instructions.length > 0)));
    console.log(
      `       plan "${plan.title}" · ${trainingDays.length} training days · ${trainingDays.reduce((n, d) => n + d.exercises.length, 0)} exercises · model=${plan.aiMetadata?.model} · ${elapsed}ms (server: ${plan.aiMetadata?.generationDurationMs}ms)`,
    );
  }

  console.log('\n--- T10: duplicate concurrent generation ---');
  const [one, two] = await Promise.all([
    call('POST', '/plans/generate', { cookie: cookieA, timeoutMs: 180000 }),
    call('POST', '/plans/generate', { cookie: cookieA, timeoutMs: 180000 }),
  ]);
  const statuses = [one.status, two.status].sort((a, b) => a - b);
  check('one succeeds, the other is rejected (409)', statuses.includes(201) && statuses.includes(409), JSON.stringify(statuses));
  const second = one.status === 409 ? one : two;
  check('409 has a safe human message', typeof second.data?.message === 'string' && second.data.message.includes('already being generated'), JSON.stringify(second.data));

  console.log('\n--- T9 / malformed ids / detail read ---');
  const list = await call('GET', '/plans', { cookie: cookieA });
  const ids = (list.data?.plans ?? []).map((p) => p._id);
  check('GET /plans returns only this user\'s plans', ids.length >= 1 && (list.data?.plans ?? []).every((p) => typeof p.title === 'string'));
  const detail = await call('GET', `/plans/${ids[0]}`, { cookie: cookieA });
  check('GET /plans/:id returns the plan', detail.status === 200 && detail.data?.plan?._id === ids[0]);
  const badId = await call('GET', '/plans/not-an-objectid', { cookie: cookieA });
  check('malformed id → 404 (no CastError 500)', badId.status === 404, String(badId.status));
  const missingId = await call('GET', '/plans/aaaaaaaaaaaaaaaaaaaaaaaa', { cookie: cookieA });
  check('unknown id → 404', missingId.status === 404, String(missingId.status));

  console.log('\n--- T7 / T8: cross-user access ---');
  const cookieB = await register('b');
  const bRead = await call('GET', `/plans/${ids[0]}`, { cookie: cookieB });
  const bDelete = await call('DELETE', `/plans/${ids[0]}`, { cookie: cookieB });
  const bList = await call('GET', '/plans', { cookie: cookieB });
  check('user B cannot read user A\'s plan (404)', bRead.status === 404, String(bRead.status));
  check('user B cannot delete user A\'s plan (404)', bDelete.status === 404, String(bDelete.status));
  check('user B\'s list is empty', (bList.data?.plans ?? []).length === 0, JSON.stringify(bList.data));
  const stillThere = await call('GET', `/plans/${ids[0]}`, { cookie: cookieA });
  check('A\'s plan survived B\'s delete attempt', stillThere.status === 200);

  console.log('\n--- T11: server started without GEMINI_API_KEY ---');
  const noKey = spawn('node', ['dist/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '5001', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childLog = '';
  noKey.stdout?.on('data', (chunk) => (childLog += String(chunk)));
  noKey.stderr?.on('data', (chunk) => (childLog += String(chunk)));

  const BASE_NOKEY = 'http://localhost:5001/api';
  let booted = false;
  for (let i = 0; i < 20 && !booted; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const probe = await call('GET', '/health', { base: BASE_NOKEY, timeoutMs: 2000 });
      booted = probe.status === 200;
    } catch {
      booted = false;
    }
  }

  try {
    check('server still boots and serves health without a key', booted, childLog.slice(0, 400));
    if (booted) {
      const cookieC = await register('c', BASE_NOKEY);
      await call('PUT', '/profile', { base: BASE_NOKEY, cookie: cookieC, body: profile });
      const blocked = await call('POST', '/plans/generate', { base: BASE_NOKEY, cookie: cookieC });
      const message = blocked.data?.message ?? '';
      check('503 configuration error, not a crash', blocked.status === 503, `${blocked.status} ${JSON.stringify(blocked.data)}`);
      check('error names the missing config safely', /GEMINI_API_KEY/.test(message) && !/AIza|stack|\/home\//i.test(message), message);
    }
  } finally {
    noKey.kill('SIGTERM');
  }

  console.log('\n--- cleanup ---');
  for (const id of ids) {
    await call('DELETE', `/plans/${id}`, { cookie: cookieA });
  }
  const afterDelete = await call('GET', '/plans', { cookie: cookieA });
  check('generated plans deleted', (afterDelete.data?.plans ?? []).length === 0, JSON.stringify(afterDelete.data));

  const { connectDB, deleteUserAndData } = require('./dist/__phase2Cleanup.js');
  await connectDB();
  await deleteUserAndData(emails);
  console.log('  PASS temporary users and their data removed');

  console.log(failures === 0 ? '\nALL HTTP CHECKS PASSED' : `\n${failures} HTTP CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error('http verify crashed:', error);
  process.exit(1);
});
