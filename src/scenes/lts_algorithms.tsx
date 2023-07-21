import { makeScene2D, Node } from '@motion-canvas/2d';
import { Random, all, sequence, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { path_length, PathVertex, PathVertexType, PathVisualizer } from '../ui/path';
import { ray2f_evaluate, vec2f, vec2f_distance, vec2f_lerp } from '../rt/math';

class StratifiedRandom {
    private dim = 0
    private index = -1
    constructor(
        public prng: Random,
        public count: number
    ) {}

    start() {
        this.dim = 0
        this.index++
    }

    nextFloat() {
        if (this.dim++ == 0) {
            return this.index / (this.count - 1)
        }
        return this.prng.nextFloat()
    }
}

class FakeRandom {
    private dim = 0
    constructor(
        public initial: number[],
        public prng = new Random(1234),
    ) {}

    nextFloat() {
        if (this.dim < this.initial.length) {
            return this.initial[this.dim++]
        }
        return this.prng.nextFloat()
    }
}

function* pathtraceSingle($: {
    cbox: CBox
}) {
    const prng = new FakeRandom([ 0.9, 0.2, 0.05 ])
    const paths = $.cbox.pathtrace(() => prng.nextFloat(), false)
    if (paths.length === 0) return
    const path = paths[0]

    for (let i = 1; i < path.length; i++) {
        const id = $.cbox.pathvis.showPath([ path[i-1], path[i] ])
        yield* $.cbox.pathvis.fadeInPath(id, 1)
    }

    yield* waitFor(1)
    yield* $.cbox.pathvis.fadeAndRemove(0.5)
}

function* lighttraceSingle($: {
    cbox: CBox
}) {
    const prng = new FakeRandom([ 0.05, 0.8, 0.94 ])
    const paths = $.cbox.lighttrace(() => prng.nextFloat(), false)
    if (paths.length === 0) return
    const path = paths[0]

    for (let i = 1; i < path.length; i++) {
        const id = $.cbox.pathvis.showPath([ path[i-1], path[i] ])
        yield* $.cbox.pathvis.fadeInPath(id, 1)
    }

    yield* waitFor(1)
    yield* $.cbox.pathvis.fadeAndRemove(0.5)
}

function* pathtrace($: {
    cbox: CBox
    useNEE: boolean
    numPaths: number
}) {
    const segments: {
        node: Node
        isCamera?: boolean
        isNEE?: boolean
        isSpecular?: boolean
        wasSpecular?: boolean
        isHelper?: boolean
    }[] = []
    const ids: number[] = []
    const prng = new StratifiedRandom(new Random(1234), $.numPaths)
    for (let i = 0; i < $.numPaths; i++) {
        prng.start()
        const paths = $.cbox.pathtrace(() => prng.nextFloat(), $.useNEE)
        for (let path of paths) {
            let hack = 0
            if (path[path.length - 1].nee) {
                hack = path_length(path.slice(0, path.length - 1))
                path = path.slice(path.length - 2)
            }
            const id = $.cbox.pathvis.showPath(path, {}, hack)
            ids.push(id)
            const s = $.cbox.pathvis.getSegments(id)
            for (let i = 1; i < path.length; i++) {
                const wasSpecular = i === 2 && path[i-1].type === PathVertexType.Specular
                segments.push({
                    node: s[i-1],
                    isCamera: i === 1,
                    isNEE: path[i].nee,
                    isSpecular: path[i].type === PathVertexType.Specular,
                    wasSpecular
                })

                if (wasSpecular) {
                    // create helper segment to show focal point
                    const helpId = $.cbox.pathvis.showPath([
                        path[i-1],
                        {
                            p: vec2f_lerp(path[i].p, path[i-1].p, 100),
                            n: vec2f(0, 0),
                            type: PathVertexType.Miss
                        }
                    ], {
                        lineDash: [8,8]
                    }, length)
                    segments.push({
                        node: $.cbox.pathvis.getSegments(helpId)[0],
                        isHelper: true, wasSpecular
                    })
                    ids.push(helpId)
                }
            }
            //n.opacity(0.2)
        }
    }

    for (const segment of segments) {
        segment.node.opacity(segment.isNEE || segment.isHelper ? 0 : 0.5)
    }

    yield* waitUntil('pt/all')

    yield* sequence(0.03, ...ids.map(id => $.cbox.pathvis.fadeInPath(id, 1)))

    yield* waitUntil('pt/cam')

    yield* all(...segments.filter(s => !s.isNEE && !s.isHelper).map(s =>
        s.node.opacity(s.isCamera ? 1 : 0.2, 1)))

    yield* waitUntil('pt/virt')

    yield* all(...segments.filter(s => !s.isNEE).map(s =>
        s.node.opacity(
            s.isSpecular && s.isCamera || s.wasSpecular ?
            1 : 0.2, 1))
    )

    yield* waitFor(1)

    yield* all(...segments.filter(s => !s.isNEE).map(s =>
        s.node.opacity(s.isHelper ? 0 : 0.2, 1)))
    
    yield* waitUntil('pt/nee')

    yield* all(...segments.map(s =>
        s.node.opacity(
            s.isNEE ?
            1 : 0.2, 1))
    )

    yield* waitUntil('pt/done')

    yield* $.cbox.pathvis.fadeAndRemove(1)
}

function* lighttrace($: {
    cbox: CBox
    numPaths: number
}) {
    const segments: {
        node: Node
        isLight?: boolean
        isMiss?: boolean
        isSpecular?: boolean
        wasSpecular?: boolean
        isHelper?: boolean
    }[] = []
    const ids: number[] = []
    const prng = new StratifiedRandom(new Random(1234), $.numPaths)
    for (let i = 0; i < $.numPaths; i++) {
        prng.start()
        const paths = $.cbox.lighttrace(() => prng.nextFloat())
        for (let path of paths) {
            let hack = 0
            if (path[path.length - 1].nee) {
                hack = path_length(path.slice(0, path.length - 1))
                path = path.slice(path.length - 2)
            }
            const id = $.cbox.pathvis.showPath(path, {}, hack)
            ids.push(id)
            const s = $.cbox.pathvis.getSegments(id)
            for (let i = 1; i < path.length; i++) {
                const wasSpecular = i === 2 && path[i-1].type === PathVertexType.Specular
                segments.push({
                    node: s[i-1],
                    isLight: i === 1 && !path[i].nee,
                    isMiss: i === 1 && path[i].type === PathVertexType.Miss,
                    isSpecular: path[i].type === PathVertexType.Specular,
                    wasSpecular
                })

                if (wasSpecular) {
                    // create helper segment to show focal point
                    const helpId = $.cbox.pathvis.showPath([
                        path[i-1],
                        {
                            p: vec2f_lerp(path[i].p, path[i-1].p, 100),
                            n: vec2f(0, 0),
                            type: PathVertexType.Miss
                        }
                    ], {
                        lineDash: [8,8]
                    }, length)
                    segments.push({
                        node: $.cbox.pathvis.getSegments(helpId)[0],
                        isHelper: true, wasSpecular
                    })
                    ids.push(helpId)
                }
            }
            //n.opacity(0.2)
        }
    }

    for (const segment of segments) {
        segment.node.opacity(segment.isHelper ? 0 : 0.5)
    }

    yield* waitUntil('lt/all')

    yield* sequence(0.01, ...ids.map(id => $.cbox.pathvis.fadeInPath(id, 1)))

    yield* waitUntil('lt/light')

    yield* all(...segments.filter(s => !s.isHelper).map(s =>
        s.node.opacity(s.isLight ? 1 : 0.2, 1)))

    yield* waitUntil('lt/virt')

    yield* all(...segments.map(s =>
        s.node.opacity(
            s.isSpecular && s.isLight || s.wasSpecular ?
            1 : 0.2, 1))
    )

    yield* waitUntil('lt/miss')

    yield* all(...segments.map(s =>
        s.node.opacity(
            s.isHelper ? 0 :
            s.isMiss ? 1 :
            0.2
        , 1))
    )

    yield* waitUntil('lt/done')

    yield* $.cbox.pathvis.fadeAndRemove(1)
}

export default makeScene2D(function* (view) {
    yield* waitUntil('lts')

    const prng = new Random(1234)

    const cbox = new CBox(view)
    cbox.cameraSpread = 90
    cbox.draw()

    yield* waitUntil('lts/pt')
    yield* pathtraceSingle({ cbox })
    yield* pathtrace({ cbox, useNEE: true, numPaths: 16 })

    yield* waitUntil('lts/lt')
    yield* lighttraceSingle({ cbox })
    yield* lighttrace({ cbox, numPaths: 20 })

    yield* waitUntil('lts/done')
    yield* waitFor(100)
});
