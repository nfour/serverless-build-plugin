import walk from 'walk'

export function walker(...args) {
    const w = walk.walk(...args)

    w.end = () => new Promise((resolve, reject) => {
        w.on("error", reject)
        w.on("end", resolve)
    })

    return w
}
