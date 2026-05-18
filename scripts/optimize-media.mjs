#!/usr/bin/env node
/**
 * One-shot media optimizer:
 *  - Converts JPG/JPEG/PNG under public/images to WebP (q=82 photos, lossless logos).
 *  - Resizes anything larger than MAX_WIDTH on the long side to MAX_WIDTH.
 *  - Re-encodes MP4 videos with H.264 CRF 28, max width 1280.
 *  - Deletes originals only after the converted file is written and non-empty.
 *  - Skips files already converted (idempotent).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'

const ROOT = path.resolve(process.cwd(), 'public', 'images')
const MAX_WIDTH = 2000
const PHOTO_QUALITY = 82
const VIDEO_CRF = 28
const VIDEO_MAX_WIDTH = 1280

const stats = { converted: 0, skipped: 0, bytesBefore: 0, bytesAfter: 0, errors: [] }

const isPhoto = (f) => /\.(jpe?g|png)$/i.test(f)
const isVideo = (f) => /\.mp4$/i.test(f)
const isLogo = (f) => /logo[^/\\]*\.png$/i.test(f)

async function walk(dir, acc = []) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, acc)
    else acc.push(full)
  }
  return acc
}

async function convertPhoto(file) {
  const before = (await fs.stat(file)).size
  const target = file.replace(/\.(jpe?g|png)$/i, '.webp')
  try { await fs.access(target); stats.skipped++; return } catch {}

  const img = sharp(file, { failOn: 'none' })
  const meta = await img.metadata()
  const needsResize = (meta.width ?? 0) > MAX_WIDTH || (meta.height ?? 0) > MAX_WIDTH
  let pipeline = img
  if (needsResize) pipeline = pipeline.resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })

  const lossless = isLogo(file)
  pipeline = pipeline.webp(lossless ? { lossless: true, effort: 6 } : { quality: PHOTO_QUALITY, effort: 5 })

  await pipeline.toFile(target)
  const after = (await fs.stat(target)).size
  if (after === 0) throw new Error('empty output')
  await fs.unlink(file)
  stats.converted++
  stats.bytesBefore += before
  stats.bytesAfter += after
  const pct = ((1 - after / before) * 100).toFixed(0)
  console.log(`  ✓ ${path.relative(ROOT, file)} → .webp  (${(before/1024/1024).toFixed(1)}MB → ${(after/1024).toFixed(0)}KB, -${pct}%)`)
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err += d.toString() })
    p.on('error', reject)
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`)))
  })
}

async function convertVideo(file) {
  const before = (await fs.stat(file)).size
  const tmp = file + '.tmp.mp4'
  await runFfmpeg([
    '-y', '-i', file,
    '-vf', `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
    '-c:v', 'libx264', '-crf', String(VIDEO_CRF), '-preset', 'slow',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    tmp,
  ])
  const after = (await fs.stat(tmp)).size
  if (after === 0) throw new Error('empty output')
  if (after >= before) {
    await fs.unlink(tmp)
    console.log(`  · ${path.relative(ROOT, file)} already smaller than re-encode, kept`)
    stats.skipped++
    return
  }
  await fs.unlink(file)
  await fs.rename(tmp, file)
  stats.converted++
  stats.bytesBefore += before
  stats.bytesAfter += after
  const pct = ((1 - after / before) * 100).toFixed(0)
  console.log(`  ✓ ${path.relative(ROOT, file)}  (${(before/1024/1024).toFixed(1)}MB → ${(after/1024/1024).toFixed(1)}MB, -${pct}%)`)
}

async function main() {
  console.log(`\nOptimizing media under: ${ROOT}\n`)
  const files = await walk(ROOT)
  const photos = files.filter(isPhoto)
  const videos = files.filter(isVideo)
  console.log(`Found ${photos.length} photos and ${videos.length} videos.\n`)

  for (const f of photos) {
    try { await convertPhoto(f) }
    catch (e) { stats.errors.push({ f, e: e.message }); console.error(`  ✗ ${f}: ${e.message}`) }
  }
  for (const f of videos) {
    try { await convertVideo(f) }
    catch (e) { stats.errors.push({ f, e: e.message }); console.error(`  ✗ ${f}: ${e.message}`) }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Converted: ${stats.converted}`)
  console.log(`Skipped:   ${stats.skipped}`)
  console.log(`Before:    ${(stats.bytesBefore/1024/1024).toFixed(1)} MB`)
  console.log(`After:     ${(stats.bytesAfter/1024/1024).toFixed(1)} MB`)
  if (stats.bytesBefore) console.log(`Saved:     ${((1 - stats.bytesAfter/stats.bytesBefore)*100).toFixed(1)}%`)
  if (stats.errors.length) {
    console.log(`\nErrors (${stats.errors.length}):`)
    for (const { f, e } of stats.errors) console.log(`  ${f}: ${e}`)
    process.exitCode = 1
  }
}

main()
