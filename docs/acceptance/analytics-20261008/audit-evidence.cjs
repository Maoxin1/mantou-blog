// Recheck whether recorded local evidence still applies. Read-only, apart
// from writing this audit record; does not contact the provider or dashboard.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const baseline = '39b51748776c4f723007b60c3c77893d16c8faf2';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const priorDir = 'docs/implementation/analytics-20261008';
const reviewedArtifacts = ['public-artifact-review.json', 'semantics-review.json'].flatMap(file =>
  read(`${priorDir}/${file}`).reviewed_files.map(entry => ({
    evidence: file, path: entry.path, expected: entry.sha256, actual: hash(entry.path), matches: hash(entry.path) === entry.sha256,
  })));
const unchanged = spawnSync('git', ['diff', '--exit-code', baseline, '--',
  'layouts', 'assets', 'static', 'hugo.toml', 'package-lock.json', 'scripts', 'tests/python', 'tests/node'], { cwd: root, encoding: 'utf8' });
if (unchanged.error) throw unchanged.error;
const priorBrowser = read(`${priorDir}/browser-regression.json`);
const scopedBrowser = read('docs/acceptance/analytics-20261008/scoped-e2e.json');
const property = read('docs/acceptance/analytics-20261008/property-coverage.json');
const manual = read('docs/acceptance/analytics-20261008/manual-check-01.json');
const observed = read('.local-evidence/analytics-private-manual/E-ANL-09.json');
const sourceObserved = read('.local-evidence/analytics-private-manual/E-ANL-10.json');
const queryContext = read('.local-evidence/analytics-private-manual/E-ANL-12.json');
const pathObserved = read('.local-evidence/analytics-private-manual/E-ANL-14.json');
const latestSource = read('.local-evidence/analytics-private-manual/E-ANL-15.json');
const timePicker = read('.local-evidence/analytics-private-manual/E-ANL-16.json');
const fixedRange = read('.local-evidence/analytics-private-manual/E-ANL-17.json');
const fixedPaths = read('.local-evidence/analytics-private-manual/E-ANL-18.json');
const representativePages = read('.local-evidence/analytics-private-manual/E-ANL-19.json');
const liveCollection = read('.local-evidence/analytics-private-manual/E-ANL-20.json');
const liveEntry = read('.local-evidence/analytics-private-manual/E-ANL-21.json');
const liveIntegrity = read('.local-evidence/analytics-private-manual/E-ANL-20-21-integrity.json');
const liveVersion = read('docs/acceptance/analytics-20261008/production-version-comparison.json');
const ownerEntry = read('docs/acceptance/analytics-20261008/manual-check-17.json');
const archiveRoot = '.local-evidence/analytics-private-manual';
const archiveMigration = read(`${archiveRoot}/archive-migration.json`);
const changedFiles = ['tests/analytics/run-local.ps1', 'tests/analytics/analytics-runner.test.cjs',
  'tests/analytics/analytics-loader.test.cjs', 'tests/e2e/analytics.spec.js'];
const matrixRows = fs.readFileSync(path.join(root, 'docs/test-matrix-analytics.md'), 'utf8').split(/\r?\n/)
  .filter(line => /^\| TM-ANL-\d{3} \|/.test(line))
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
const matrixCounts = {};
for (const row of matrixRows) matrixCounts[row[7]] = (matrixCounts[row[7]] || 0) + 1;
const documents = ['docs/feature-ledger.md', 'docs/test-matrix-analytics.md', 'docs/edge-case-register.md',
  'tests/README.md', 'docs/acceptance/analytics-20261008/README.md', 'docs/acceptance/analytics-20261008/learning-review.md',
  'docs/acceptance/analytics-20261008/manual-check-01.md', 'docs/acceptance/analytics-20261008/manual-check-02.md',
  'docs/acceptance/analytics-20261008/manual-check-03.md', 'docs/acceptance/analytics-20261008/manual-check-04.md',
  'docs/acceptance/analytics-20261008/manual-check-05.md', 'docs/acceptance/analytics-20261008/manual-check-06.md',
  'docs/acceptance/analytics-20261008/manual-check-07.md', 'docs/acceptance/analytics-20261008/manual-check-08.md',
  'docs/acceptance/analytics-20261008/manual-check-09.md', 'docs/acceptance/analytics-20261008/manual-check-10.md',
  'docs/acceptance/analytics-20261008/archive-retention.md',
  'docs/acceptance/analytics-20261008/manual-check-11.md',
  'docs/acceptance/analytics-20261008/manual-check-12.md',
  'docs/acceptance/analytics-20261008/manual-check-13.md',
  'docs/acceptance/analytics-20261008/manual-check-14.md',
  'docs/acceptance/analytics-20261008/manual-check-15.md',
  'docs/acceptance/analytics-20261008/manual-check-16.md',
  'docs/acceptance/analytics-20261008/live-verification-20261009.md',
  'docs/specs/analytics-v1.md',
  'docs/acceptance/analytics-20261008/manual-check-17.md',
  'docs/acceptance/analytics-20261008/final-acceptance-20261009.md',
  'docs/proposals/analytics-easier-view-20261009.md'];
const missingLinks = [];
let checkedLocalLinks = 0;
for (const file of documents) {
  const document = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of document.matchAll(/\[[^\]\r\n]+\]\(([^)\r\n]+)\)/g)) {
    if (/^(https?:|#)/.test(match[1])) continue;
    checkedLocalLinks++;
    const target = path.resolve(root, path.dirname(file), match[1].split('#')[0]);
    if (!fs.existsSync(target)) missingLinks.push({ file, link: match[1] });
  }
}
const record = {
  evidenceId: 'E-ANL-03', featureId: 'ANL', recordedAtUtc: new Date().toISOString(),
  baseline, actualHead: git(['rev-parse', 'HEAD']),
  environment: { platform: process.platform, node: process.version,
    hugo: execFileSync('hugo', ['version'], { encoding: 'utf8' }).trim(),
    playwright: require(path.join(root, 'node_modules/@playwright/test/package.json')).version },
  unchangedApplicationAndExistingUnitChecks: unchanged.status === 0,
  reviewedArtifacts,
  vendorByteCheck: { expectedGitBlob: git(['rev-parse', 'HEAD:static/lib/waline/3.15.2/waline.js']),
    actualGitBlob: git(['hash-object', '--no-filters', 'static/lib/waline/3.15.2/waline.js']),
    textAttribute: git(['check-attr', 'text', '--', 'static/lib/waline/3.15.2/waline.js']) },
  previousFullBrowserRegression: { evidence: `${priorDir}/browser-regression.json`, stats: priorBrowser.stats,
    note: 'Prior recorded version, not rerun as a full suite during acceptance. Existing application and original tests unchanged; new cases have separate fresh execution.' },
  currentScopedBrowser: scopedBrowser.stats,
  currentProperty: property,
  currentEvidenceFiles: { browser: 'docs/acceptance/analytics-20261008/scoped-e2e.json',
    property: 'docs/acceptance/analytics-20261008/property-coverage.json',
    note: 'Archived execution evidence, not the mutable runtime report that discovery may overwrite.' },
  changedTestFiles: changedFiles.map(file => ({ path: file, sha256: hash(file) })),
  matrixCheck: { rows: matrixRows.length, uniqueIds: new Set(matrixRows.map(row => row[0])).size,
    nineColumns: matrixRows.every(row => row.length === 9), counts: matrixCounts },
  documentCheck: { files: documents, checkedLocalLinks, missingLinks },
  manualDashboard: { state: 'user-reported-permission-checked; complete-result-context-pending',
    evidenceId: manual.evidenceId, source: manual.source, executor: manual.executor,
    executionDate: manual.executionDate, ownerSession: manual.permission.ownerSession,
    anonymousSession: manual.permission.anonymousSession, permissionStatus: manual.permission.status,
    rangeAsReported: manual.rangeAsReported, providerTimezone: manual.providerTimezone,
    metricDisplayObservation: manual.metricDisplayObservation,
    providerRequestsSentByNewTests: false, authenticatedDashboardCheckedByCodex: false,
    note: 'The audit validates evidence records and provenance, not provider authentication or metrics itself.' },
  additionalManualScreenshot: { evidenceId: observed.evidenceId, site: observed.site,
    reportTitle: observed.reportTitle, range: observed.relativeRange, displayedTimezone: observed.displayedTimezone,
    visibleFilters: observed.filters, visitsValueObserved: Number.isFinite(observed.visits), pageViewsValueObserved: observed.pageViews !== null,
    scopeCorrection: 'Later current URL still filters English path; visible tag absence did not establish whole-site scope.',
    privateEvidenceRetained: fs.existsSync(path.join(root, '.local-evidence/analytics-private-manual/E-ANL-09.png')),
    privateScreenshotHashMatches: hash('.local-evidence/analytics-private-manual/E-ANL-09.png').toUpperCase() === observed.screenshotSha256,
    note: 'Actual counts and account screenshot remain in Git-ignored private files, not in this public audit record.' },
  sourceDisplayScreenshot: { evidenceId: sourceObserved.evidenceId, site: sourceObserved.site,
    range: sourceObserved.relativeRange, displayedTimezone: sourceObserved.displayedTimezone,
    visibleFilters: sourceObserved.filters, itemsSelection: sourceObserved.itemsSelection,
    scopeCorrection: 'Source display is verified for the observed query; whole-site source scope is not established.',
    sourceClassificationObserved: sourceObserved.referrers.map(row => row.label),
    sourceMetricValueObserved: sourceObserved.referrers.every(row => Number.isFinite(row.value)),
    privateScreenshotHashMatches: hash('.local-evidence/analytics-private-manual/E-ANL-10.png').toUpperCase() === sourceObserved.screenshotSha256,
    note: 'Source-reading scenario passed; absolute query context and path completeness remain pending.' },
  currentUrlContext: { evidenceId: queryContext.evidenceId, decodedPath: queryContext.decodedPath,
    relativeWindowParameter: queryContext.relativeWindowParameter, linksGeneratedOnly: queryContext.linksGeneratedOnly,
    navigationExecuted: queryContext.navigationExecuted, note: 'Private URL retained separately; no authenticated request made.' },
  latestPathScreenshot: { evidenceId: pathObserved.evidenceId, site: pathObserved.site,
    range: pathObserved.relativeRange, displayedTimezone: pathObserved.displayedTimezone,
    selectedDimension: pathObserved.selectedDimension,
    pathsObserved: pathObserved.paths.map(row => row.path),
    workValueObserved: pathObserved.paths.some(row => row.path === '/works/mantou-checklist-pwa/' && Number.isFinite(row.pageViews)),
    privateScreenshotHashMatches: hash(`${archiveRoot}/E-ANL-14.png`).toUpperCase() === pathObserved.screenshotSha256,
    note: 'Named work result observed; shared absolute range and complete query context still pending. Review time is not query time.' },
  latestSourceScreenshot: { evidenceId: latestSource.evidenceId, site: latestSource.site,
    range: latestSource.relativeRange, displayedTimezone: latestSource.displayedTimezone,
    selectedDimension: latestSource.selectedDimension,
    sourceLabelsObserved: latestSource.referrers.map(row => row.label),
    valuesObserved: latestSource.referrers.every(row => Number.isFinite(row.value)),
    privateScreenshotHashMatches: hash(`${archiveRoot}/E-ANL-15.png`).toUpperCase() === latestSource.screenshotSha256,
    note: 'Actual source-reading evidence; absolute range and complete attribution rules remain pending. Counts retained privately.' },
  latestDatePicker: { evidenceId: timePicker.evidenceId,
    displayedTimezone: timePicker.displayedTimezone,
    endpointsObserved: Boolean(timePicker.pickerFrom && timePicker.pickerTo),
    absoluteRangeAppliedConfirmed: timePicker.absoluteRangeAppliedConfirmed,
    privateScreenshotHashMatches: hash(`${archiveRoot}/E-ANL-16.png`).toUpperCase() === timePicker.screenshotSha256,
    note: 'Picker fields visible; applied fixed query and shared page context remain pending. Original fields and screenshot retained privately.' },
  latestFixedRange: { evidenceId: fixedRange.evidenceId,
    displayedTimezone: fixedRange.displayedTimezone,
    absoluteSelectionDisplayed: fixedRange.absoluteSelectionDisplayed,
    aggregateValuesObserved: Number.isFinite(fixedRange.pageViews) && Number.isFinite(fixedRange.visits),
    privateScreenshotHashMatches: hash(`${archiveRoot}/E-ANL-17.png`).toUpperCase() === fixedRange.screenshotSha256,
    note: 'Fixed range selection and aggregate visible; representative paths in that same window remain pending. Raw fields retained privately.' },
  latestFixedPaths: { evidenceId: fixedPaths.evidenceId, site: fixedPaths.site,
    displayedTimezone: fixedPaths.displayedTimezone, selectedDimension: fixedPaths.selectedDimension,
    rangeContextEvidenceId: fixedPaths.rangeContextEvidenceId,
    workValueObserved: fixedPaths.paths.some(row => row.path === '/works/mantou-checklist-pwa/' && Number.isFinite(row.pageViews)),
    privateScreenshotHashMatches: hash(`${archiveRoot}/E-ANL-18.png`).toUpperCase() === fixedPaths.screenshotSha256,
    note: 'Work PV visible in fixed window; English path visible but value cropped; Chinese target still outside visible list.' },
  representativePageCheck: { evidenceId: representativePages.evidenceId,
    matrixId: representativePages.result.matrixId, status: representativePages.result.status,
    rangeContextEvidenceId: representativePages.rangeContextEvidenceId,
    targetPathsObserved: ['/p/20260803/', '/en/p/20260803/', '/works/mantou-checklist-pwa/'].every(target =>
      representativePages.paths.some(row => (row.path || row.resolvedPath) === target && Number.isFinite(row.pageViews))),
    privateScreenshotHashesMatch: representativePages.files.every(entry => hash(`${archiveRoot}/${entry.name}`).toUpperCase() === entry.sha256),
    note: 'Actual three-page reading check passed; original counts stay private. This does not validate raw ingestion or all failure combinations.' },
  currentProductionVerification: { collectionEvidenceId: liveCollection.evidenceId,
    entryEvidenceId: liveEntry.evidenceId,
    liveCollectionState: liveCollection.productionObservationState,
    collectionRequestAndResponseObserved: liveCollection.collectionRequestObserved && liveCollection.collectionResponseObserved,
    sourceArticleVisible: liveCollection.articleHeadingVisible,
    publicCmsEntryResults: liveEntry.cases.map(item => ({ cmsPath: item.cmsPath, passed: item.passed })),
    privateScriptAndRecordHashesMatch: liveIntegrity.files.every(entry => hash(`${archiveRoot}/${entry.name}`).toUpperCase() === entry.sha256),
    providerDashboardLoginAutomated: false,
    ownerFullEntrySummary: { evidenceId: ownerEntry.evidenceId, matrixId: ownerEntry.matrixId,
      executor: ownerEntry.executor, status: ownerEntry.status, answerVerbatim: ownerEntry.answerVerbatim,
      note: 'User-reported actual full workflow, not a Codex private login.' },
    note: 'Actual production request/response and public entry checks; not exact ingestion or private-owner workflow proof.' },
  productionVersionComparison: { evidenceId: liveVersion.evidenceId,
    localBaseline: liveVersion.localBaseline,
    productionCommit: liveVersion.productionVersionObservation.version.commit_sha,
    targetFilesByteIdentical: liveVersion.targetFilesByteIdentical,
    comparedFiles: liveVersion.sourceComparison.length,
    note: 'Two source trees compared after actual production upgrade; old full regression remains old-version evidence.' },
  privateArchive: { relativePath: archiveRoot, migrationId: archiveMigration.recordId,
    originalFilesVerified: archiveMigration.verifiedFileCount,
    allOriginalHashesRetained: archiveMigration.files.every(entry => hash(`${archiveRoot}/${entry.name}`).toUpperCase() === entry.sha256),
    gitIgnored: git(['check-ignore', '--', `${archiveRoot}/E-ANL-13.png`]) === `${archiveRoot}/E-ANL-13.png`,
    outsideTestOutputTree: !path.resolve(root, archiveRoot).startsWith(path.join(root, 'test-results') + path.sep) },
};
fs.writeFileSync(path.join(__dirname, 'evidence-audit.json'), JSON.stringify(record, null, 2) + '\n');
const passed = record.actualHead === baseline && record.unchangedApplicationAndExistingUnitChecks
  && reviewedArtifacts.every(entry => entry.matches)
  && record.vendorByteCheck.expectedGitBlob === record.vendorByteCheck.actualGitBlob
  && scopedBrowser.stats.expected === 9 && scopedBrowser.stats.unexpected === 0
  && scopedBrowser.stats.skipped === 0 && scopedBrowser.stats.flaky === 0
  && property.totalSamples === 192 && property.sourceSha256 === hash('layouts/partials/analytics.html')
  && matrixRows.length === 29 && record.matrixCheck.uniqueIds === 29 && record.matrixCheck.nineColumns
  // TM-ANL-006/005/004/002 have actual manual evidence E-ANL-04/10/19/24;
  // automated behavior assertions and browser/property results are unchanged.
  && matrixCounts['通过'] === 18 && matrixCounts['阻塞'] === 8 && matrixCounts['延期'] === 1 && matrixCounts['不适用'] === 2
  && manual.evidenceId === 'E-ANL-04' && manual.permission.matrixId === 'TM-ANL-006'
  && manual.permission.status === '通过' && manual.permission.ownerSession === '可以查看报表'
  && manual.permission.anonymousSession === '登录提示'
  && observed.evidenceId === 'E-ANL-09' && observed.site === 'mantou-blog.pages.dev'
  && record.additionalManualScreenshot.privateScreenshotHashMatches
  && sourceObserved.evidenceId === 'E-ANL-10' && record.sourceDisplayScreenshot.privateScreenshotHashMatches
  && queryContext.evidenceId === 'E-ANL-12' && queryContext.decodedPath === '/en/p/20260803/'
  && pathObserved.evidenceId === 'E-ANL-14' && record.latestPathScreenshot.workValueObserved
  && record.latestPathScreenshot.privateScreenshotHashMatches
  && latestSource.evidenceId === 'E-ANL-15' && record.latestSourceScreenshot.valuesObserved
  && record.latestSourceScreenshot.privateScreenshotHashMatches
  && timePicker.evidenceId === 'E-ANL-16' && record.latestDatePicker.endpointsObserved
  && record.latestDatePicker.privateScreenshotHashMatches
  && fixedRange.evidenceId === 'E-ANL-17' && record.latestFixedRange.absoluteSelectionDisplayed
  && record.latestFixedRange.aggregateValuesObserved && record.latestFixedRange.privateScreenshotHashMatches
  && fixedPaths.evidenceId === 'E-ANL-18' && record.latestFixedPaths.workValueObserved
  && record.latestFixedPaths.privateScreenshotHashMatches
  && representativePages.evidenceId === 'E-ANL-19' && representativePages.result.status === '通过'
  && record.representativePageCheck.targetPathsObserved && record.representativePageCheck.privateScreenshotHashesMatch
  && liveCollection.evidenceId === 'E-ANL-20' && record.currentProductionVerification.collectionRequestAndResponseObserved
  && liveEntry.evidenceId === 'E-ANL-21' && liveEntry.cases.length === 2 && liveEntry.cases.every(item => item.passed)
  && record.currentProductionVerification.privateScriptAndRecordHashesMatch
  && liveVersion.evidenceId === 'E-ANL-23' && liveVersion.targetFilesByteIdentical
  && ownerEntry.evidenceId === 'E-ANL-24' && ownerEntry.matrixId === 'TM-ANL-002'
  && ownerEntry.status === '通过' && ownerEntry.executor === 'mantou'
  && ownerEntry.answerVerbatim === '已按上述入口走通，能查看正确站点报表'
  && record.privateArchive.allOriginalHashesRetained && record.privateArchive.gitIgnored && record.privateArchive.outsideTestOutputTree
  && missingLinks.length === 0;
process.stdout.write(`Evidence record integrity: ${passed ? 'PASS' : 'FAIL'}; adopted-round acceptance evidence: ${passed ? 'COMPLETE' : 'CHECK FAILED'}; eight unadopted SPEC GAP candidates retained.\n`);
process.exitCode = passed ? 0 : 1;
