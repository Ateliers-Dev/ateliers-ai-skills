import { execFileSync } from 'node:child_process';

const branch = 'sync/common-ai-standards';
const title = 'docs: Skill 共通ルールを同期';
const body = 'standards/ の正本を各 Skill の references/ に同期しました。\n\nこの PR は GitHub Actions による自動生成です。';
const closeComment = '最新 main に対する同期差分がなくなったため、自動でクローズしました。';

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

async function createPullRequest(run) {
  await run([
    'pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body,
  ]);
}

export async function reconcileSyncPullRequest({ hasDiff, run = runGh }) {
  const response = await run([
    'pr', 'list', '--base', 'main', '--head', branch, '--state', 'all', '--limit', '100',
    '--json', 'number,state,mergedAt',
  ]);
  const pullRequests = JSON.parse(response || '[]');
  const openPullRequest = pullRequests.find((pr) => pr.state === 'OPEN');

  if (!hasDiff) {
    if (!openPullRequest) return 'unchanged';
    await run(['pr', 'close', String(openPullRequest.number), '--comment', closeComment]);
    return 'closed';
  }

  if (openPullRequest) return 'updated';

  const closedUnmergedPullRequest = pullRequests.find(
    (pr) => pr.state === 'CLOSED' && !pr.mergedAt,
  );
  if (closedUnmergedPullRequest) {
    const number = String(closedUnmergedPullRequest.number);
    try {
      await run(['pr', 'reopen', number]);
      return 'reopened';
    } catch (reopenError) {
      let current;
      try {
        const stateResponse = await run(['pr', 'view', number, '--json', 'state,mergedAt']);
        current = JSON.parse(stateResponse);
      } catch (stateError) {
        throw new Error(
          `Could not reopen synchronization PR #${number}, and its current state could not be verified: ${stateError.message}`,
          { cause: reopenError },
        );
      }

      if (current.state === 'OPEN') return 'reopened';
      if (current.state !== 'MERGED' && !current.mergedAt) {
        throw new Error(
          `Could not reopen synchronization PR #${number}; current state is ${current.state}. ${reopenError.message}`,
          { cause: reopenError },
        );
      }

      await createPullRequest(run);
      return 'created';
    }
  }

  await createPullRequest(run);
  return 'created';
}

if (process.argv[1]?.endsWith('manage-common-standards-pr.mjs')) {
  try {
    if (!['true', 'false'].includes(process.env.SYNC_CHANGED)) {
      throw new Error('SYNC_CHANGED must be either true or false');
    }
    const result = await reconcileSyncPullRequest({ hasDiff: process.env.SYNC_CHANGED === 'true' });
    console.log(`Synchronization PR action: ${result}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
