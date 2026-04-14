import {
  readArtifact,
  validateBenchArtifact,
  validateHotPathArtifacts,
  validateSmokeAndTranscriptArtifacts,
  type ArtifactReadback,
} from "./bench-signoff-validators";

export interface SignoffResult {
  generatedAt: string;
  suite: string;
  benchOutputPath: string;
  artifacts: ArtifactReadback[];
}

export async function buildSignoff(options: {
  suite: string;
  outputPath: string;
  smokePath: string;
  liveTranscriptPath: string;
  hotPathArtifactPaths: string[];
}): Promise<SignoffResult> {
  const bench = await validateBenchArtifact(options.outputPath, options.suite);
  await validateSmokeAndTranscriptArtifacts(options.smokePath, options.liveTranscriptPath);
  await validateHotPathArtifacts({
    hotPathArtifactPaths: options.hotPathArtifactPaths,
    expectedBenchPath: options.outputPath,
    benchTimestamp: bench.timestamp,
    expectedSuite: options.suite,
  });
  const artifacts = await Promise.all([
    readArtifact(options.outputPath),
    readArtifact(options.smokePath),
    readArtifact(options.liveTranscriptPath),
    ...options.hotPathArtifactPaths.map((path) => readArtifact(path)),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    suite: options.suite,
    benchOutputPath: options.outputPath,
    artifacts,
  };
}
