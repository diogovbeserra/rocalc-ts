import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const defaultUpstreamSources = [
  {
    name: 'attackjom',
    repoUrl: 'https://github.com/attackjom/tong-calc-ro-host.git',
    branch: 'main',
  },
  {
    name: 'diwesta',
    repoUrl: 'https://github.com/Diwesta-Nut/tong-calc-ro-host.git',
    branch: 'main',
  },
  {
    name: 'turugrura',
    repoUrl: 'https://github.com/turugrura/tong-calc-ro-host.git',
    branch: 'main',
  },
]
const upstreamSources = defaultUpstreamSources

const sourceRootDir = 'docs'
const targetRootDir = resolve(process.cwd(), 'public/legacy')
const sourceDataDirRelative = 'assets/demo/data'
const sourceImageDirsRelative = [
  'assets/demo/images/items',
  'assets/demo/images/jobs',
  'assets/demo/images/others',
]
const allowSmallerDataSync = process.env.ROCALC_SYNC_ALLOW_SMALLER === '1'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {}
  return null
}

function mergeMissingFields(targetValue, sourceValue, stats, depth = 0) {
  if (!isPlainObject(targetValue) || !isPlainObject(sourceValue)) {
    return
  }

  for (const [key, sourceChildValue] of Object.entries(sourceValue)) {
    if (!(key in targetValue)) {
      targetValue[key] = deepClone(sourceChildValue)
      if (depth === 0) {
        stats.addedTopLevelKeys++
      } else {
        stats.addedNestedFields++
      }
      continue
    }

    const targetChildValue = targetValue[key]
    if (isPlainObject(targetChildValue) && isPlainObject(sourceChildValue)) {
      mergeMissingFields(targetChildValue, sourceChildValue, stats, depth + 1)
    }
  }
}

function syncDataFile(sourceFilePath, targetFilePath) {
  const stats = {
    file: targetFilePath,
    mode: 'none',
    addedTopLevelKeys: 0,
    addedNestedFields: 0,
    copiedFile: false,
    replacedArray: false,
    skippedSafety: false,
    reason: null,
  }

  if (!existsSync(targetFilePath)) {
    mkdirSync(dirname(targetFilePath), { recursive: true })
    copyFileSync(sourceFilePath, targetFilePath)
    stats.mode = 'copy_missing_target'
    stats.copiedFile = true
    return stats
  }

  const sourceJson = safeReadJson(sourceFilePath)
  const targetJson = safeReadJson(targetFilePath)
  if (sourceJson === null || targetJson === null) {
    stats.mode = 'skip_invalid_json'
    stats.reason = 'source_or_target_invalid_json'
    return stats
  }

  if (isPlainObject(sourceJson) && isPlainObject(targetJson)) {
    mergeMissingFields(targetJson, sourceJson, stats)
    if (stats.addedTopLevelKeys > 0 || stats.addedNestedFields > 0) {
      writeFileSync(targetFilePath, JSON.stringify(targetJson), 'utf8')
      stats.mode = 'merge_object'
    } else {
      stats.mode = 'no_changes'
    }
    return stats
  }

  if (Array.isArray(sourceJson) && Array.isArray(targetJson)) {
    const shouldReplace =
      sourceJson.length > targetJson.length ||
      (allowSmallerDataSync && sourceJson.length !== targetJson.length)

    if (!shouldReplace) {
      stats.mode = 'skip_array_safety'
      stats.skippedSafety = true
      stats.reason = `source_len_${sourceJson.length}_target_len_${targetJson.length}`
      return stats
    }

    copyFileSync(sourceFilePath, targetFilePath)
    stats.mode = 'replace_array'
    stats.replacedArray = true
    return stats
  }

  stats.mode = 'skip_unsupported_json_shape'
  stats.reason = 'non_object_and_non_array'
  return stats
}

function syncDataDirectory(sourceRootPath, targetRootPath, sourceRunResult) {
  const sourceDataDirPath = join(sourceRootPath, sourceDataDirRelative)
  const targetDataDirPath = join(targetRootPath, sourceDataDirRelative)
  if (!existsSync(sourceDataDirPath)) {
    sourceRunResult.warnings.push(`missing_source_data_dir:${sourceDataDirRelative}`)
    return
  }

  const sourceFiles = readdirSync(sourceDataDirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()

  for (const fileName of sourceFiles) {
    const sourceFilePath = join(sourceDataDirPath, fileName)
    const targetFilePath = join(targetDataDirPath, fileName)
    const fileStats = syncDataFile(sourceFilePath, targetFilePath)
    sourceRunResult.dataFiles.push({
      sourceFile: join(sourceDataDirRelative, fileName),
      targetFile: join(sourceDataDirRelative, fileName),
      ...fileStats,
    })
  }
}

function syncImageDirectory(sourceRootPath, targetRootPath, imageDirRelative, sourceRunResult) {
  const sourceImageDirPath = join(sourceRootPath, imageDirRelative)
  const targetImageDirPath = join(targetRootPath, imageDirRelative)
  if (!existsSync(sourceImageDirPath)) {
    sourceRunResult.warnings.push(`missing_source_image_dir:${imageDirRelative}`)
    return
  }

  if (!existsSync(targetImageDirPath)) {
    mkdirSync(targetImageDirPath, { recursive: true })
  }

  const targetFiles = new Set(readdirSync(targetImageDirPath))
  const sourceFiles = readdirSync(sourceImageDirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  let copiedMissingFiles = 0
  for (const fileName of sourceFiles) {
    if (targetFiles.has(fileName)) {
      continue
    }
    copyFileSync(join(sourceImageDirPath, fileName), join(targetImageDirPath, fileName))
    copiedMissingFiles++
  }

  sourceRunResult.imageDirs.push({
    dir: imageDirRelative,
    copiedMissingFiles,
    sourceFileCount: sourceFiles.length,
  })
}

if (!existsSync(targetRootDir)) {
  throw new Error(`Target folder not found: ${targetRootDir}`)
}

const tmpWorkDir = mkdtempSync(join(tmpdir(), 'rocalc-upstream-'))
const runMetadata = {
  syncedAtUtc: new Date().toISOString(),
  sourceRootDir,
  targetRootDir,
  upstreamSources: [],
  note: 'Merged from multiple upstream repositories by adding missing data keys/fields and missing images only.',
}

try {
  for (const source of upstreamSources) {
    const sourceResult = {
      name: source.name,
      repoUrl: source.repoUrl,
      branch: source.branch,
      commit: null,
      status: 'ok',
      warnings: [],
      dataFiles: [],
      imageDirs: [],
    }

    const cloneDir = join(tmpWorkDir, source.name)
    try {
      console.log(`Cloning upstream: ${source.repoUrl} (${source.branch})`)
      execFileSync(
        'git',
        ['clone', '--depth', '1', '--branch', source.branch, source.repoUrl, cloneDir],
        { stdio: 'inherit' },
      )

      sourceResult.commit = execFileSync('git', ['-C', cloneDir, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim()

      const sourceRootPath = join(cloneDir, sourceRootDir)
      if (!existsSync(sourceRootPath)) {
        sourceResult.status = 'error'
        sourceResult.warnings.push(`missing_source_root_dir:${sourceRootDir}`)
        runMetadata.upstreamSources.push(sourceResult)
        continue
      }

      syncDataDirectory(sourceRootPath, targetRootDir, sourceResult)
      for (const imageDirRelative of sourceImageDirsRelative) {
        syncImageDirectory(sourceRootPath, targetRootDir, imageDirRelative, sourceResult)
      }
    } catch (error) {
      sourceResult.status = 'error'
      sourceResult.warnings.push(
        error instanceof Error ? error.message : 'unknown_error_while_syncing_source',
      )
    }

    runMetadata.upstreamSources.push(sourceResult)
  }

  const metadataPath = join(targetRootDir, '.upstream-sync.json')
  writeFileSync(metadataPath, `${JSON.stringify(runMetadata, null, 2)}\n`, 'utf8')

  console.log(`Sync complete. Metadata written to: ${metadataPath}`)
} finally {
  rmSync(tmpWorkDir, { recursive: true, force: true })
}
