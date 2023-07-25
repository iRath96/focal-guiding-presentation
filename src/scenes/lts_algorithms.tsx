import { Circle, Layout, Line, makeScene2D, Node, Ray } from '@motion-canvas/2d';
import { Random, Vector2, all, chain, createRef, createSignal, debug, delay, sequence, tween, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { path_length, path_segments, PathVertex, PathVertexType, PathVisualizer, shuffle } from '../ui/path';
import { Ray2f, ray2f_evaluate, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_lerp, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_sub, Vector2f } from '../rt/math';
import { PSSMLT } from '../rt/pssmlt';
import { Captions } from '../common/captions';
import { linear_lookup, linspace, polar_plot, sample, saturate, theta_linspace } from '../common/guiding';

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

interface Rnd {
    nextFloat(): number
}

class FakeRandom {
    private dim = 0
    constructor(
        public initial: number[],
        public prng: Rnd = new Random(1234),
    ) {}

    restart() {
        this.dim = 0
    }

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
        captions().reset(),
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

function* pssmlt($: {
    cbox: CBox
}) {
    const pssmlt = new PSSMLT()
    pssmlt.seed([ 0.603, 0.3, 0.22 ])
    pssmlt.stepSize = 0.02

    const numProposals = 250
    const pathvis = $.cbox.pathvis
    let acceptedPath: number = -1
    let proposalPath: number = -1
    for (let i = 0; i < numProposals; i++) {
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
        yield pathvis.getPath(acceptedPath).opacity(1 - i / numProposals)
        
        //yield* pathvis.updatePath(proposalPath, path, 2)
        yield* pathvis.updatePath(acceptedPath, path,
            Math.max(Math.pow(1 - Math.min(2 * i / numProposals, 1), 2), 0.05))
    }

    pathvis.removeAll()
}

function* guiding($: {
    cbox: CBox
    view: Node
}) {
    function findGuidePaths(spread = 0, numCandidates = 1000, seed = 1234) {
        const prevCameraSpread = $.cbox.cameraSpread
        const prevCameraDir = $.cbox.cameraDir
        $.cbox.cameraSpread = spread
        $.cbox.cameraDir = -4.5

        const paths: PathVertex[][] = []
        const prng = new StratifiedRandom(new Random(seed), numCandidates)
        for (let i = 0; i < numCandidates; i++) {
            const path = $.cbox.pathtrace(() =>
                prng.nextFloat(), {
                    useNEE: false,
                    maxDepth: 3,
                }
            )[0]
            if (path[path.length - 1].type !== PathVertexType.Light) continue
            
            const cosLight = -vec2f_dot(
                vec2f_direction(path[path.length-2].p, path[path.length-1].p),
                path[path.length-1].n
            )
            if (cosLight < 0.9) continue
            if (path[1].type !== PathVertexType.Diffuse) continue
            if (path[1].p.y > 100) continue
            
            paths.push(path)
        }

        $.cbox.cameraSpread = prevCameraSpread
        $.cbox.cameraDir = prevCameraDir
        return paths
    }

    const pathvis = $.cbox.pathvis
    const view = <Layout zIndex={10} />
    $.view.add(view)

    const hitpoint = createSignal<Vector2f>()
    const centralPaths: number[] = []
    for (const path of findGuidePaths()) {
        if (centralPaths.length === 0) {
            // first path, show extra path for camera segment
            hitpoint(path[1].p)
            const helpId = pathvis.showPath(path.slice(0, 2))
            yield* pathvis.fadeInPath(helpId, 1)
        }

        centralPaths.push(pathvis.showPath(path.slice(1), { opacity: 0.3 }))
    }

    yield* pathvis.fadeInPaths(centralPaths, 1)
    yield* waitFor(1)

    yield* waitUntil('guiding/dist')
    const guidingDistRes = 512
    const guidingUniform = createSignal(1)
    const guidingBrokenTarget = createSignal(false)
    const guidingDist = createSignal<number[]>(() => {
        const targets = guidingBrokenTarget() ?
        [
            { d: vec2f_normalized(vec2f(-1, -0.80)), exp: 10, w: 1.7 },
            { d: vec2f_normalized(vec2f(-1,  1.60)), exp: 6 , w: 0.5 },
        ] :
        [
            { d: vec2f_normalized(vec2f(-1, -1.15)), exp: 180, w: 1 },
            { d: vec2f_normalized(vec2f(-1, -0.48)), exp: 180, w: 1 },
            { d: vec2f_normalized(vec2f(-1,  1.60)), exp: 6  , w: 0.5 },
        ]
        const normal = vec2f(-1, 0)
        let pdfs: number[] = []
        for (let i = 0; i <= guidingDistRes; i++) {
            const theta = theta_linspace(i, guidingDistRes)
            const wo = vec2f_polar(theta)

            let r = 0
            for (const { d, exp, w } of targets) {
                const cosThetaWr = Math.max(vec2f_dot(wo, d), 0)
                r += w * Math.pow(cosThetaWr, exp) * (Math.sqrt(exp) + 2) / (2 * Math.PI)
            }
            r += 0.1
            r = (1 - guidingUniform()) * (r - 1) + 1
            //r *= 1 - guidingUniform()
            r *= vec2f_dot(normal, wo) > 0 ? 1 : 0//Math.max(vec2f_dot(normal, wo), 0)
            r *= 0.8
            //if (i / guidingDistRes < guidingUniform()) r = 0
            if (r < 1e-8) r = 0

            pdfs.push(r)
        }
        return pdfs
    })

    const guidingPlot = <Line
        points={() => polar_plot(guidingDist(), 100)}
        stroke="rgb(10, 103, 255)"
        lineWidth={4}
        fill="rgba(10, 103, 255, 0.5)"
        position={hitpoint}
        opacity={0}
    />
    view.add(guidingPlot)
    yield* all(
        guidingPlot.opacity(1, 1),
        pathvis.opacity(0.3, 1),
    )
    yield* guidingUniform(0, 2)

    yield* waitUntil('guiding/sampling')
    const sampleT = createSignal(-1)
    const numGuidingSamples = 10 // or 6
    const guidingSamples = createSignal(() => {
        const rngs = linspace(numGuidingSamples)
        return sample(guidingDist(), rngs).map(i => vec2f_polar(
            theta_linspace(i, guidingDistRes), Math.sqrt(
                linear_lookup(guidingDist(), i)
            )
        ))
    })
    for (let i = 0; i < numGuidingSamples; i++) {
        const t = i / (numGuidingSamples - 1)
        view.add(<Ray
            from={[0,0]}
            to={() => vec2f_multiply(guidingSamples()[i],
                saturate(2 * sampleT() - (1 - t)) * 150
            )}
            stroke="#fff"
            opacity={0.7}
            position={hitpoint}
            lineWidth={4}
            arrowSize={8}
            endArrow
        />)
    }
    yield* sampleT(1, 2)
    yield* sampleT(0, 2)

    yield* waitUntil('guiding/parallax')
    const hitpointMid    = hitpoint()
    const hitpointTop    = vec2f_add(hitpoint(), vec2f(0, -110))
    const hitpointBottom = vec2f_add(hitpoint(), vec2f(0,  110))
    const spatialExtent = createSignal(0)
    view.add(<Layout position={vec2f_add(hitpoint(), vec2f(50, 0))}>
        <Ray
            from={() => vec2f(0, -Math.max(0, spatialExtent() - 10))}
            to=  {() => vec2f(0, +Math.max(0, spatialExtent() - 10))}
            stroke={"#fff"}
            opacity={0.5}
            lineWidth={9}
            arrowSize={12}
            startArrow
            endArrow
        />
        <Circle
            size={() => Math.min(spatialExtent(), 20)}
            fill={"#fff"}
            stroke={"#000"}
            lineWidth={4}
        />
    </Layout>)

    yield* all(
        pathvis.opacity(1, 1),
        guidingPlot.opacity(0, 1),
    )
    const pathsToBeHidden = shuffle([...centralPaths]).slice(2)
    yield* sequence(0.05,
        ...pathsToBeHidden.map(id =>
            pathvis.getPath(id).opacity(0, 0.2))
    )
    pathvis.removePaths(pathsToBeHidden)
    const neighboringPaths: number[] = []
    const directionsView = <Layout opacity={0} />
    const directionsMerge = createSignal(0)
    for (const path of findGuidePaths(15, 350, 10)) {
        const id = pathvis.showPath(path, { opacity: 0.2, visible: true })
        const dist = vec2f_distance(path[1].p, hitpoint())
        pathvis.getPath(id).opacity(createSignal(() =>
            saturate((spatialExtent() - dist) / 10)
        ))
        neighboringPaths.push(id)

        const direction = vec2f_direction(path[1].p, path[2].p)
        directionsView.add(<Ray
            from={[0,0]}
            to={() =>
                vec2f_multiply(direction, 80)}
            position={() =>
                vec2f_lerp(path[1].p, hitpointMid, directionsMerge())}
            stroke={"#fff"}
            lineWidth={3}
            arrowSize={8}
            opacity={0.8}
            endArrow
        />)
    }
    yield* spatialExtent(20, 2)
    yield* spatialExtent(120, 2)
    //yield* pathvis.opacity(0.5, 1)
    view.add(directionsView)
    yield* directionsView.opacity(1, 1)
    yield* directionsMerge(1, 2)

    guidingBrokenTarget(true)
    guidingUniform(1)
    yield* guidingPlot.opacity(1, 1)
    yield* guidingUniform(0, 1)
    yield* waitFor(1)
    yield* all(
        guidingPlot.opacity(0, 1),
        directionsMerge(0, 1)
    )

    //yield* hitpoint(hitpointTop, 1).to(hitpointBottom, 2).to(hitpointMid, 1)

    yield* all(
        view.opacity(0, 2),
        pathvis.fadeAndRemove(2),
    )
    
    view.remove()
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
    yield* captions().reset()

    yield* waitUntil('lts/lt')
    yield* captions().updateTitle("Light tracing")
    yield* lighttraceSingle({ cbox })
    yield* lighttrace({ cbox, numPaths: 18 })
    yield* captions().reset()

    yield* waitUntil('lts/bdpt')
    yield* all(
        captions().updateTitle("Bidirectional path tracing"),
        captions().updateReference("[Lafortune and Willems 1993; Veach and Guibas 1995a]")
    )
    yield* bdptSingle({ cbox })
    yield* captions().reset()

    yield* waitUntil('lts/vm')
    yield* vertexMerging({ cbox, view })

    yield* waitUntil('lts/pssmlt')
    yield* all(
        captions().updateTitle("Markov-chain Monte Carlo"),
        captions().updateReference("[Metropolis et al. 1953; Veach and Guibas 1997; Kelemen et al. 2002]")
    )
    yield* pssmlt({ cbox })
    yield* captions().reset()

    yield* waitUntil('lts/guiding')
    yield* all(
        captions().updateTitle("Path guiding"),
        captions().updateReference("[Vorba et al. 2014; Müller et al. 2017]")
    )
    yield* guiding({ cbox, view })
    yield* captions().reset()

    yield* waitUntil('lts/done')
    yield* waitFor(100)
});
