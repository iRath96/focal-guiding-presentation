import { Circle, Layout, Line, makeScene2D, Node } from '@motion-canvas/2d';
import { Random, Vector2, all, chain, createRef, createSignal, debug, sequence, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { path_length, path_segments, PathVertex, PathVertexType, PathVisualizer } from '../ui/path';
import { Ray2f, ray2f_evaluate, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_lerp, vec2f_multiply, vec2f_sub } from '../rt/math';
import { PSSMLT } from '../rt/pssmlt';
import { Captions } from '../common/captions';

const captions = createRef<Captions>()

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
    const path = $.cbox.pathtrace(() => prng.nextFloat(), {
        useNEE: false })[0]
    
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
    const path = $.cbox.lighttrace(() => prng.nextFloat(), {
        useNEE: false })[0]

    for (let i = 1; i < path.length; i++) {
        const id = $.cbox.pathvis.showPath([ path[i-1], path[i] ])
        yield* $.cbox.pathvis.fadeInPath(id, 1)
    }

    yield* waitFor(1)
    yield* $.cbox.pathvis.fadeAndRemove(0.5)
}

function* bdptSingle($: {
    cbox: CBox
}) {
    const pathvis = $.cbox.pathvis

    const cameraPrng = new FakeRandom([ 1, 0.11, 0.73 ])
    const cameraPath = $.cbox.pathtrace(() => cameraPrng.nextFloat(), {
        useNEE: false,
        maxDepth: 2,
    })[0]
    const lightPrng = new FakeRandom([ 0.9, 0.89, 0.05 ])
    const lightPath = $.cbox.lighttrace(() => lightPrng.nextFloat(), {
        useNEE: false,
        maxDepth: 3,
    })[0]

    function* showSubpath(subPath: PathVertex[]) {
        const segments: number[] = []
        yield* chain(...[...path_segments(subPath)].map(segment => {
            const id = pathvis.showPath(segment)
            segments.push(id)
            return pathvis.fadeInPath(id, 0.5)
        }))
        allSegments.push(segments)
    }

    const allSegments: number[][] = []
    yield* waitUntil('bdpt/camera')
    yield* showSubpath(cameraPath)
    yield* waitUntil('bdpt/light')
    yield* showSubpath(lightPath)

    yield* waitUntil('bdpt/connections')
    yield* all(
        ...allSegments.flat().map(id =>
            pathvis.getPath(id).opacity(0.2, 1))
    )

    for (let cameraI = 0; cameraI < cameraPath.length; cameraI++) {
        //allSegments[1].map(id =>
        //    pathvis.getPath(id).opacity(0.2))
        for (let lightI = 0; lightI < lightPath.length; lightI++) {
            let cVertex = cameraPath[cameraI]
            let lVertex = lightPath[lightI]

            if (cameraI > 0) {
                yield* pathvis
                    .getPath(allSegments[0][cameraI-1])
                    .opacity(1, 0.25)
            }
            if (cameraI === 0 && lightI > 0) {
                yield* pathvis
                    .getPath(allSegments[1][lightI-1])
                    .opacity(1, 0.25)
            }

            //if (lightI === 0 || cameraI === 0) continue
            if (cVertex.type === PathVertexType.Specular) continue
            if (lVertex.type === PathVertexType.Specular) continue

            if (cameraI === 0) cVertex = {
                ...cVertex,
                p: $.cbox.camera.center
            }
            if (lightI === 0) lVertex = {
                ...lVertex,
                p: $.cbox.light.center
            }
            const pD = vec2f_direction(cVertex.p, lVertex.p)
            if (cameraI === 0) cVertex = {
                ...cVertex,
                p: vec2f_add(cVertex.p, vec2f_multiply(pD, $.cbox.camera.radius))
            }
            if (lightI === 0) lVertex = {
                ...lVertex,
                p: vec2f_add(lVertex.p, vec2f_multiply(pD, -$.cbox.light.radius))
            }

            const visRay: Ray2f = {
                o: cVertex.p,
                d: vec2f_direction(cVertex.p, lVertex.p)
            }
            let isVisible = vec2f_distance(
                $.cbox.intersect(visRay, false).p, lVertex.p) < 1
            if (vec2f_dot(visRay.d, cVertex.n) < 0) isVisible = false
            //if (vec2f_dot(visRay.d, lVertex.n) < 0) isVisible = false
            if (!isVisible) continue
            
            const helpId = $.cbox.pathvis.showPath([
                cVertex, lVertex
            ], {
                lineDash: [ 8, 8 ],
                stroke: isVisible ? "#fff" : "red"
            })
            yield* pathvis.fadeInPath(helpId, 0.25)
        }
    }

    yield* waitUntil('bdpt/done')
    yield* $.cbox.pathvis.fadeAndRemove(0.5)
}

function* vertexMerging($: {
    cbox: CBox
    view: Node
}) {
    const view = <Layout />;
    const pathvis = new PathVisualizer(view)
    $.view.add(view);

    const cameraPrng = new FakeRandom([ 0.17 ])
    const cameraPath = $.cbox.pathtrace(() => cameraPrng.nextFloat(), {
        useNEE: false,
        maxDepth: 2,
    })[0]
    const lightPrng = new FakeRandom([ 0.898 ])
    const lightPath = $.cbox.lighttrace(() => lightPrng.nextFloat(), {
        useNEE: false,
        maxDepth: 2,
    })[0]

    const mergedPoint = vec2f_lerp(
        cameraPath[cameraPath.length - 1].p,
        lightPath[lightPath.length - 1].p,
        0.5
    )

    const cameraId = pathvis.showPath(cameraPath)
    const lightId = pathvis.showPath(lightPath)

    yield* waitUntil('vm/camera')
    yield* pathvis.fadeInPath(cameraId, 1)
    yield* waitUntil('vm/light')
    yield* pathvis.fadeInPath(lightId, 1)

    yield* waitUntil('vm/merge')
    yield* all(
        captions().updateTitle("Photon Mapping"),
        captions().updateReference("[Shirley et al. 1995; Jensen 1996; Walter et al. 1997]"),
    )
    const mergeHighlight = <Circle
        size={[50, 100]}
        position={vec2f_sub(mergedPoint, vec2f(0, 6))}
        fill="rgba(0, 255, 0, 0.3)"
        zIndex={-1}
    />;
    view.add(mergeHighlight)
    yield* mergeHighlight.scale(0, 0).to(1, 1)
    yield* all(
        pathvis.updatePath(cameraId, cameraPath.map((v, i) =>
            i == 2 ? lightPath[2] : v
        ), 3),
        mergeHighlight.position(vec2f_sub(lightPath[2].p, vec2f(0, 6)), 3),
        mergeHighlight.scale([ 1, 0.6 ], 3),
    )

    yield* waitUntil('vm/done')
    yield* all(
        view.opacity(0, 1),
        captions().updateTitle(),
        captions().updateReference(),
    )
    view.remove()
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
        a?: PathVertex
        b?: PathVertex
    }[] = []
    const ids: number[] = []
    const prng = new StratifiedRandom(new Random(1234), $.numPaths)
    for (let i = 0; i < $.numPaths; i++) {
        prng.start()
        const paths = $.cbox.pathtrace(() => prng.nextFloat(), {
            useNEE: $.useNEE,
            maxDepth: 2
        })
        for (let path of paths) {
            let hack = 0
            if (path[path.length - 1].nee) {
                hack = path_length(path.slice(0, path.length - 1))
                path = path.slice(path.length - 2)
            }
            const id = $.cbox.pathvis.showPath(path, { length: hack })
            ids.push(id)
            const s = $.cbox.pathvis.getSegments(id)
            for (let i = 1; i < path.length; i++) {
                const wasSpecular = i === 2 && path[i-1].type === PathVertexType.Specular
                segments.push({
                    node: s[i-1],
                    isCamera: i === 1,
                    isNEE: path[i].nee,
                    isSpecular: path[i].type === PathVertexType.Specular,
                    wasSpecular,
                    a: path[i-1],
                    b: path[i]
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
                        lineDash: [8,8],
                        length
                    })
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
    yield* $.cbox.pathvis.fadeInPaths(ids, 1, 0.03)
    
    yield* waitUntil('pt/cam')
    yield* all(...segments.filter(s => !s.isNEE && !s.isHelper).map(s =>
        s.node.opacity(s.isCamera ? 1 : 0.2, 1)))

    yield* waitUntil('pt/virt')
    yield* all(...segments.filter(s => !s.isNEE).map(s =>
        s.node.opacity(
            s.isSpecular && s.isCamera || s.wasSpecular ?
            1 : 0.2, 1))
    )

    yield* waitFor(3)

    yield* all(...segments.filter(s => !s.isNEE).map(s =>
        s.node.opacity(s.isHelper ? 0 : 0.2, 1)))
    
    yield* waitUntil('pt/nee')
    yield* captions().updateReference("Next event estimation")

    yield* all(...segments.map(s =>
        s.node.opacity(
            s.isHelper ? 0 :
            s.isNEE ? 1 :
            0.2
        , 1))
    )

    yield* waitUntil('pt/mnee')
    yield* captions().updateReference("Manifold NEE [Hanika et al. 2015; Zeltner et al. 2020]")

    const mneeIds: number[] = []
    for (const segment of segments) {
        if (!segment.isNEE) continue
        const start = segment.a.p
        let end = $.cbox.mirroredLight.center
        const d = vec2f_direction(start, end)
        end = vec2f_sub(end, vec2f_multiply(d, $.cbox.light.radius))

        const mend = $.cbox.mirrorAtCeiling(end)
        const mid = vec2f_add(start, vec2f_multiply(d,
            ($.cbox.ceilingY - start.y) / d.y
        ))

        mneeIds.push($.cbox.pathvis.showPath([
            { p: start },
            { p: mid },
            { p: mend }
        ], {
            lineDash: [8,8]
        }))
    }

    yield* all(...segments.map(s =>
        s.node.opacity(
            s.isHelper ? 0 :
            s.isNEE ? 0.2 :
            0.2
        , 1))
    )
    yield* $.cbox.pathvis.fadeInPaths(mneeIds, 1)

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
        const paths = $.cbox.lighttrace(() => prng.nextFloat(), {
            maxDepth: 2
        })
        for (let path of paths) {
            let hack = 0
            if (path[path.length - 1].nee) {
                hack = path_length(path.slice(0, path.length - 1))
                path = path.slice(path.length - 2)
            }
            const id = $.cbox.pathvis.showPath(path, { length: hack })
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
                        lineDash: [8,8],
                        length
                    })
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
    yield* $.cbox.pathvis.fadeInPaths(ids, 1, 0.01)

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

export function* pssmlt($: {
    cbox: CBox
}) {
    const pssmlt = new PSSMLT()
    pssmlt.seed([ 0.603, 0.3, 0.22 ])
    pssmlt.stepSize = 0.02

    const pathvis = $.cbox.pathvis
    let acceptedPath: number = -1
    let proposalPath: number = -1
    for (let i = 0; i < 300; i++) {
        const path = $.cbox.pathtrace(() =>
            pssmlt.nextFloat(), {
                useNEE: false,
                maxDepth: 4,
            })[0]
        const success =
            path[path.length - 1].type == PathVertexType.Light &&
            (acceptedPath < 0 || pssmlt.randomAccept())
        if (success) {
            pssmlt.accept()
        } else {
            pssmlt.reject()
        }

        if (!success) continue
        
        if (acceptedPath === -1) {
            acceptedPath = pathvis.showPath(path)
            yield* pathvis.fadeInPath(acceptedPath, 1)
            yield* waitFor(1)

            /*proposalPath = pathvis.showPath(path, {
                opacity: 0.4,
                visible: true
            });*/
        }
        yield pathvis.getPath(acceptedPath).opacity(1 - i / 300)
        
        //yield* pathvis.updatePath(proposalPath, path, 2)
        yield* pathvis.updatePath(acceptedPath, path,
            Math.max(Math.pow(1 - Math.min(i / 150, 1), 2), 0.05))
    }

    pathvis.removeAll()
}

export default makeScene2D(function* (originalView) {
    originalView.add(<Captions
        ref={captions}
        chapter="Previous works"
    />);

    const view = <Layout
        position={[-350, 55]}
        scale={[ -1, 1 ]}
    />
    originalView.add(view)

    const cbox = new CBox(view)
    cbox.cameraSpread = 90
    cbox.draw()
    
    cbox.cameraNode.scale(0)
    yield* cbox.cameraNode.scale(1, 1)

    yield* waitUntil('lts/pt')
    yield* all(
        captions().updateTitle("Path tracing"),
        captions().updateReference("[Kajiya 1986]")
    )
    yield* pathtraceSingle({ cbox })
    yield* pathtrace({ cbox, useNEE: true, numPaths: 16 })
    yield* all(
        captions().updateTitle(),
        captions().updateReference(),
    )

    yield* waitUntil('lts/lt')
    yield* captions().updateTitle("Light tracing")
    yield* lighttraceSingle({ cbox })
    yield* lighttrace({ cbox, numPaths: 18 })
    yield* all(
        captions().updateTitle(),
        captions().updateReference(),
    )

    yield* waitUntil('lts/bdpt')
    yield* all(
        captions().updateTitle("Bidirectional path tracing"),
        captions().updateReference("[Lafortune and Willems 1993; Veach and Guibas 1995a]")
    )
    yield* bdptSingle({ cbox })
    yield* all(
        captions().updateTitle(),
        captions().updateReference(),
    )

    yield* waitUntil('lts/vm')
    yield* vertexMerging({ cbox, view })

    yield* waitUntil('lts/pssmlt')
    yield* all(
        captions().updateTitle("Markov-chain Monte Carlo"),
        captions().updateReference("[Metropolis et al. 1953; Veach and Guibas 1997; Kelemen et al. 2002]")
    )
    yield* pssmlt({ cbox })

    yield* waitUntil('lts/done')
    yield* waitFor(100)
});
