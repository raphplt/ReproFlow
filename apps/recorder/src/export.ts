import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RecordingTraceSchema } from "@reproflow/event-schema";

export async function exportTrace(trace: unknown, directory: string) {
  const validated = RecordingTraceSchema.parse(trace);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${validated.recordingId}.json`);
  await writeFile(path, `${JSON.stringify(validated, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return path;
}
