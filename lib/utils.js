import walk from 'walk'

export function walker(directory) {
    const w = walk.walk(directory)

    w.end = () => new Promise((resolve, reject) => {
        w.on("error", reject)
        w.on("end", resolve)
    })

    return w
}
