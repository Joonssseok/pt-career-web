import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = await PGlite.create();
const files = [
  "tests/profile-videos-fixture.sql",
  "supabase/migrations/20261120094453_profile_videos.sql",
  "supabase/migrations/20261120100420_profile_video_captions.sql",
  "tests/profile-videos-permissions.sql",
  "tests/profile-videos-stale-edit.sql",
  "tests/profile-videos-account-purge.sql",
  "tests/profile-video-captions.sql",
  "supabase/rollback/profile_videos.sql",
  "tests/profile-videos-rollback.sql",
];
let assertions = 0;
try {
  for (const file of files) {
    const sql = await readFile(file, "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
    if (file.startsWith("tests/"))
      assertions += (
        sql.match(/select public\.fixture_(assert|throws)\(/g) ?? []
      ).length;
  }
  console.log(
    `PASS ${assertions} isolated PostgreSQL assertions; no remote database used.`,
  );
} finally {
  await db.close();
}
