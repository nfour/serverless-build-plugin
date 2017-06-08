import { Archiver } from 'archiver';
import * as c from 'chalk';
import * as walk from 'findit';
import { readFile } from 'fs-extra';
import * as YAML from 'js-yaml';
import { isObject } from 'lutils';
import * as path from 'path';

export function walker (...args) {
  const w = walk(...args);

  w.end = () => new Promise((resolve, reject) => {
    w.on('error', reject);
    w.on('stop', resolve);
    w.on('end', resolve);
  });

  return w;
}

/**
 * Read any of:
 * - .json
 * - .yml / .yaml
 * - .js
 *
 * @param {String} fileLookup
 * @returns {any} config
 */
export async function loadFile (fileLookup) {
  const tryExts = ['.yml', '.yaml', ''];

  for (const ext of tryExts) {
    try {
      const filePath = require.resolve(`${fileLookup}${ext}`);

      if (/\.ya?ml$/i.test(filePath)) {
        return YAML.load(await readFile(filePath, 'utf8'));
      }

      return require(filePath); // eslint-disable-line
    } catch (err) { /* */ }
  }

  return null;
}

/**
 *  Normalizes transforming and zip allocation for walked files.
 *  Used by SourceBundler & ModuleBundler.
 */
export async function handleFile ({
    filePath, relPath,
    archive, useSourceMaps,
    transformExtensions, transforms,
}: {
  archive: Archiver;
  useSourceMaps: boolean;
  transformExtensions: string[];
  filePath: string;
  relPath: string;
  transforms: any[]
}) {
  const extname = path.extname(filePath);
  const isTransformable = transformExtensions.some((ext) => `.${ext}` === extname.toLowerCase());

  // TODO: make each transformer check extensions itself, and concat their
  // extension whitelist to check here.
  if (isTransformable) {
    //
    // JAVASCRIPT
    //

    let code = await readFile(filePath, 'utf8');
    let map = '';
    let destRelPath = relPath;

    /**
     *  Runs transforms against the code, mutating the code & map
     *  with each iteration, optionally producing source maps
     */
    if (transforms.length) {
      for (const transformer of transforms) {
        const result = transformer.run({ code, map, filePath, relPath });

        if (result.code) {
          code = result.code;
          if (result.map) { map = result.map; }
          if (result.relPath) { destRelPath = result.relPath; }
        }
      }
    }

    console.log(filePath)

    archive.append(new Buffer(code), { name: destRelPath });

    if (useSourceMaps && map) {
      if (isObject(map)) { map = JSON.stringify(map); }

      archive.append(new Buffer(map), { name: `${destRelPath}.map` });
    }
  } else {
    //
    // ARBITRARY FILES
    //

    archive.file(filePath, { name: relPath });
  }

  return archive;
}

export function displayModule ({ filePath, packageJson }: { filePath: string, packageJson?: any }) {
  const basename = path.basename(filePath);

  return `${
    packageJson && c.grey(`${packageJson.version}\t`)
  }${
    c.grey(
      filePath.replace(basename, `${c.reset(basename)}`),
    )
  }`;
}

export function colorizeConfig (config) {
  return c.grey(`{ ${Object.keys(config).map((key) => {
    const val = config[key];
    return `${c.white(key)}: ${val ? c.green(val) : c.yellow(val)}`;
  }).join(', ')} }`);
}
