import { makeScene2D, Node } from '@motion-canvas/2d';
import { Random, all, sequence, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { PathVertexType, PathVisualizer } from '../ui/path';

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

    $.cbox.pathvis.removeAll()
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
}

function* pathtrace($: {
    cbox: CBox
    useNEE: boolean
    numPaths: number
}) {
    const segments: {
        node: Node
        isCamera: boolean
        isNEE: boolean
        hitSpecular: boolean
    }[] = []
    const ids: number[] = []
    const prng = new StratifiedRandom(new Random(1234), $.numPaths)
    for (let i = 0; i < $.numPaths; i++) {
        prng.start()
        const paths = $.cbox.pathtrace(() => prng.nextFloat(), $.useNEE)
        for (let path of paths) {
            if (path[path.length - 1].nee) {
                path = path.slice(path.length - 2)
            }
            const id = $.cbox.pathvis.showPath(path)
            ids.push(id)
            const n = $.cbox.pathvis.getPath(id)
            const s = $.cbox.pathvis.getSegments(id)
            for (let i = 1; i < path.length; i++) {
                segments.push({
                    node: s[i-1],
                    isCamera: i === 1,
                    isNEE: path[i].nee,
                    hitSpecular: path[i].type === PathVertexType.Specular
                })
            }
            //n.opacity(0.2)
        }
    }

    for (const segment of segments) {
        segment.node.opacity(segment.isNEE ? 0 : 1)
    }

    for (const segment of segments) {
        if (segment.isNEE) continue
        segment.node.opacity(segment.isCamera ? 0.8 : 0.2)
    }


    yield* sequence(0.05, ...ids.map(id => $.cbox.pathvis.fadeInPath(id, 2)))
}

function* lighttrace($: {
    cbox: CBox
    numPaths: number
}) {
    const ids: number[] = []
    const prng = new StratifiedRandom(new Random(1234), $.numPaths)
    for (let i = 0; i < $.numPaths; i++) {
        prng.start()
        const paths = $.cbox.lighttrace(() => prng.nextFloat())
        for (const path of paths) {
            const id = $.cbox.pathvis.showPath(path)
            ids.push(id)
            const n = $.cbox.pathvis.getPath(id)
            //n.opacity(0.2)
        }
    }

    yield* sequence(0.05, ...ids.map(id => $.cbox.pathvis.fadeInPath(id, 2)))
}

export default makeScene2D(function* (view) {
    yield* waitUntil('lts')

    const prng = new Random(1234)

    const cbox = new CBox(view)
    cbox.cameraSpread = 90
    cbox.draw()

    yield* waitUntil('lts/pt')
    yield* pathtraceSingle({ cbox })
    yield* waitUntil('lts/pt2')
    yield* pathtrace({ cbox, useNEE: true, numPaths: 16 })
    yield* waitUntil('lts/nee')

    cbox.pathvis.removeAll()

    yield* lighttraceSingle({ cbox })
    yield* waitFor(10)
    yield* lighttrace({ cbox, numPaths: 20 })

    yield* waitUntil('lts/done')
    yield* waitFor(100)
});
