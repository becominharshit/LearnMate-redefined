/**
 * Standalone CLI Runner for the LearnMate Open-Source PYQ Dataset Ingestion Engine
 * Usage:
 *   npx tsx scripts/ingestPyqDatasets.ts [--dry-run] [--source jee_mocks_db|learnopt|qpe|jee_main_pyq]
 */

import {
  EXTERNAL_DATASET_SOURCE_REGISTRY,
  VERIFIED_SAMPLE_JEE_CSV,
  VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
  VERIFIED_SAMPLE_LEARNOPT_JSONL,
  runDatasetImportPipeline,
  type DatasetSourceId,
  type UnifiedQuestionRecord,
  type SourceToLearnMateIdMapEntry,
} from '../src/ingestion';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceFlagIdx = args.indexOf('--source');
  const requestedSource =
    sourceFlagIdx !== -1 && args[sourceFlagIdx + 1]
      ? (args[sourceFlagIdx + 1] as DatasetSourceId)
      : null;

  const jobs: Array<{
    sourceId: DatasetSourceId;
    format: 'JSON' | 'JSONL' | 'CSV';
    rawContent: string;
  }> = [
    {
      sourceId: 'jee_mocks_db',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
    },
    {
      sourceId: 'learnopt',
      format: 'JSONL',
      rawContent: VERIFIED_SAMPLE_LEARNOPT_JSONL,
    },
    {
      sourceId: 'jee_mocks_db',
      format: 'CSV',
      rawContent: VERIFIED_SAMPLE_JEE_CSV,
    },
    {
      sourceId: 'jee_main_pyq',
      format: 'JSON',
      rawContent: '[]',
    },
  ];

  const filteredJobs = requestedSource
    ? jobs.filter((j) => j.sourceId === requestedSource)
    : jobs;

  let workingCorpus: UnifiedQuestionRecord[] = [];
  let workingIdMap: Record<string, SourceToLearnMateIdMapEntry> = {};

  console.log('===================================================================');
  console.log(
    `LearnMate V1 — Open-Source PYQ Ingestion Pipeline (${dryRun ? 'DRY RUN' : 'LIVE'})`
  );
  console.log('===================================================================');

  for (const job of filteredJobs) {
    const audit = EXTERNAL_DATASET_SOURCE_REGISTRY[job.sourceId];
    console.log(`\n-> Source: ${audit?.displayName || job.sourceId}`);
    console.log(`   URL: ${audit?.verifiedRepoUrl}`);
    console.log(`   License: ${audit?.softwareLicense}`);
    console.log(`   Clearance: ${audit?.clearanceStatus}`);

    const res = await runDatasetImportPipeline({
      sourceId: job.sourceId,
      format: job.format,
      rawContent: job.rawContent,
      dryRun,
      existingCorpusOverride: workingCorpus,
      idMapOverride: workingIdMap,
      persistToStorage: !dryRun,
    });

    workingCorpus = res.resultingCorpus;
    workingIdMap = res.resultingIdMap;

    const r = res.report;
    console.log(
      `   Summary: inspected=${r.totalInspected}, approved=${r.importedApprovedCount}, pendingReview=${r.importedPendingReviewCount}, updated=${r.updatedIncrementalCount}, exactDupSkipped=${r.skippedExactDuplicateCount}, nearDupFlagged=${r.flaggedNearDuplicateCount}, failed=${r.failedValidationCount}`
    );
    if (r.failedRecords.length > 0) {
      for (const fail of r.failedRecords) {
        console.log(
          `   [REJECTED/FAILED] ${fail.externalId}: ${fail.issues
            .map((i) => `${i.code} (${i.message})`)
            .join('; ')}`
        );
      }
    }
  }

  console.log('\n===================================================================');
  console.log(`Total Approved Questions in Unified Corpus: ${workingCorpus.filter((q) => q.status === 'APPROVED').length}`);
  console.log('===================================================================');
}

main().catch((err) => {
  console.error('Ingestion pipeline failed:', err);
  process.exit(1);
});
