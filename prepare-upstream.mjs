import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Keep this compatibility patch bounded to the pinned upstream source.
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected one upstream anchor: ${before}`);
  return source.replace(before, after);
}

const agentPath = 'src/server/dot-agent.ts';
const agent = replaceOnce(
  readFileSync(agentPath, 'utf8'),
  'modelOptions: { max_completion_tokens: 2200 },',
  `modelOptions: {
                max_completion_tokens: 2200,
                ...(this.config.model === 'gpt-6-luna' &&
                [undefined, 'https://api.openai.com/v1', 'https://api.openai.com/v1/'].includes(this.config.baseUrl)
                  ? { reasoning_effort: 'none' }
                  : {}),
              },`,
);

const testPath = 'tests/tanstack-agent.test.ts';
let test = readFileSync(testPath, 'utf8');
const replacements = [
  [
    'function fixture() {',
    'function fixture(config: { model?: string; baseUrl?: string } = {}) {',
  ],
  [
    "      baseUrl: 'https://unused.invalid/v1',",
    "      baseUrl: 'https://unused.invalid/v1',\n      ...config,",
  ],
  [
    `it('executes a page tool, continues with its result, and emits AG-UI text and tool events', async () => {
  const f = fixture();`,
    `it.each([
  ['gpt-6-luna', undefined, 'none'],
  ['gpt-6-luna', 'https://api.openai.com/v1', 'none'],
  ['gpt-6-luna', 'https://api.openai.com/v1/', 'none'],
  ['gpt-4.1-mini', 'https://api.openai.com/v1', undefined],
  ['gpt-6-luna', 'https://unused.invalid/v1', undefined],
])('executes a page tool and continues with %s at %s', async (model, baseUrl, reasoningEffort) => {
  const f = fixture({ model, baseUrl });`,
  ],
  [
    "    'https://unused.invalid/v1/chat/completions',",
    "    `${(baseUrl ?? 'https://api.openai.com/v1').replace(/\\/$/, '')}/chat/completions`,",
  ],
  [
    "  expect(request.model).toBe('custom-model');",
    '  expect(request.model).toBe(model);\n  expect(request.reasoning_effort).toBe(reasoningEffort);',
  ],
  [
    '  const continuation = JSON.parse(String(network.mock.calls[1][1]?.body));',
    `  const continuation = JSON.parse(String(network.mock.calls[1][1]?.body));
  expect(continuation.model).toBe(model);
  expect(continuation.max_completion_tokens).toBe(2200);
  expect(continuation.reasoning_effort).toBe(reasoningEffort);`,
  ],
];
for (const [before, after] of replacements) test = replaceOnce(test, before, after);

// Validate every anchor before changing either file.
writeFileSync(agentPath, agent);
writeFileSync(testPath, test);
