import { readdir, writeFile, readFile, mkdir, rmdir } from 'node:fs/promises';
import path from 'node:path';
import exec from "nanoexec";

await mkdir('.files');
await mkdir('.img');
const COMMON_PATH = path.resolve(process.cwd(), '../common'); 
const PIECES_PATH = path.resolve(COMMON_PATH, 'pieces'); 
const TEMP_FILES_PATH = path.resolve(process.cwd(), './.files');
const TEMP_IMG_PATH = path.resolve(process.cwd(), './.img');
// drop .webp from filename
const piecesDir = (await readdir(PIECES_PATH)).map(file => file.slice(0, -5));
/** @type {[string[][]]} each arr is a single row (X) of 64 */
const [tileOrder] = JSON.parse(await readFile(COMMON_PATH + '/tile_id_grid.json', { encoding: 'utf8' }));
for (let i = 0; i < tileOrder.length; i++) {
  // create filelist according to ffmpeg file format; if common/pieces dir doesn't have an image, use blank.webp instead 
  const filelists = tileOrder[i].map(file => `file '${PIECES_PATH}${path.sep}${piecesDir.includes(file) ? file : "blank"}.webp'`).join("\n");
  await writeFile(`${TEMP_FILES_PATH}${path.sep}files-${i}.txt`, filelists);
}

// read ffmpeg-format textfiles that we just wrote
const filelistPaths = await readdir(TEMP_FILES_PATH);
const ffmpegTempThreads = [];
const numFromFile = (str) => str.split('-')[1].slice(0, -4);
console.log('Starting partial image generation.')
for (const filelistPath of filelistPaths) {
  // extract the number from filename -> files-1.txt -> 1
  const num = numFromFile(filelistPath);
  const ffmpegThread = exec(`ffmpeg`, ['-f', 'concat', '-safe', '0', '-i', `${path.resolve(TEMP_FILES_PATH, filelistPath)}`, "-filter_complex", "tile=64x1:padding=0:margin=0:color=black [v]", "-map", '[v]', '-update', 'true', `${TEMP_IMG_PATH}${path.sep}temp-${num}.png`, '-y']);
  ffmpegTempThreads.push(ffmpegThread);
}

await Promise.all(ffmpegTempThreads);
console.log('Generated partial images. Generating final image now.');
// collect absolute paths of the 64 images we just created with ffmpeg
const paths = (await readdir(TEMP_IMG_PATH)).map(file => path.resolve(TEMP_IMG_PATH, file));
// ensure the images are ordered properly
const sorted = paths.sort((a, b) => numFromFile(a.slice(-8)) - numFromFile(b.slice(-8)))
// create the final ffmpeg textfile
await writeFile(`${TEMP_FILES_PATH}${path.sep}final.txt`, sorted.map(file => `file '${file}'`).join('\n'));
await exec(`ffmpeg`, ['-f', 'concat', '-safe', '0', '-i', `${path.resolve(TEMP_FILES_PATH, 'final.txt')}`, "-filter_complex", "[0:v] scale=-1:128,tile=1x64:padding=0:margin=0:color=black [v]", "-map", '[v]', '-update', 'true', 'final.png', '-y']);
await rmdir('.files', { recursive: true, force: true });
await rmdir('.img', { recursive: true, force: true });
console.log('Done. Goodbye.');