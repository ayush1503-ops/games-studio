/**
 * One-off generator: turns the studio's existing site content (src/data/initialData.ts)
 * into a self-contained JSON seed file for the API package.
 *
 * Run from server/:  npx tsx scripts/build-seed-content.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const frontendData = await import('../../src/data/initialData.js');
const { INITIAL_GAMES, INITIAL_NEWS, INITIAL_JOBS, STUDIO_TIMELINE, TEAM_MEMBERS } = frontendData;

const payload = {
  generatedFrom: 'src/data/initialData.ts',
  games: INITIAL_GAMES,
  news: INITIAL_NEWS,
  jobs: INITIAL_JOBS,
  studioTimeline: STUDIO_TIMELINE,
  teamMembers: TEAM_MEMBERS,
};

const target = path.resolve(import.meta.dirname, '../prisma/seed-content.json');
await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${target}\n  games: ${INITIAL_GAMES.length}\n  news: ${INITIAL_NEWS.length}\n  jobs: ${INITIAL_JOBS.length}`
);
