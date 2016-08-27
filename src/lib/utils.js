import walk from 'walk'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import path from 'path'

export function walker(...args) {
    const w = walk.walk(...args)

    w.end = () => new Promise((resolve, reject) => {
        w.on("error", reject)
        w.on("end", resolve)
    })

    return w
}

/**
 *  Normalizes transforming and zip allocation for walked files.
 *  Used by SourceBundler & ModuleBundler.
 */
export async function handleFile({
    filePath, relPath,
    artifact, zipConfig, useSourceMaps,
    transformExtensions, transforms
}) {
    const extname         = path.extname(filePath)
    const isTransformable = transformExtensions.some((ext) => `.${ext}` === extname.toLowerCase() )

    // TODO: make each transformer check extensions itself, and concat their
    // extension whitelist to check here.
    if ( isTransformable ) {
        //
        // JAVASCRIPT
        //

        let code = await fs.readFileAsync(filePath, 'utf8')
        let map  = ''

        /**
         *  Runs transforms against the code, mutating the code & map
         *  with each iteration, optionally producing source maps
         */
        if ( transforms.length ) {
            for ( let transformer of transforms ) {
                let result = transformer.run({ code, map, filePath, relPath })

                if ( result.code ) {
                    code = result.code
                    if ( result.map ) map = result.map
                }
            }
        }

        artifact.addBuffer( new Buffer(code), relPath, zipConfig )

        if ( useSourceMaps && map ) {
            if ( typeOf.Object(map) ) map = JSON.stringify(map)

            artifact.addBuffer( new Buffer(map), `${relPath}.map`, zipConfig )
        }
    } else {
        //
        // ARBITRARY FILES
        //

        artifact.addFile(filePath, relPath, zipConfig)
    }

    return artifact
}
