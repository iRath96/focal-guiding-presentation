import { Circle, Gradient, Img, Layout, Line, makeScene2D, Node, Ray, RayProps, Txt } from '@motion-canvas/2d';
import { Random, SignalValue, SimpleSignal, all, chain, createRef, createSignal, delay, sequence, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox, makeCBoxView } from '../common/cbox';
import { Path, path_length, path_segments, PathVertex, PathVertexType, PathVisualizer, shuffle } from '../ui/path';
import { Circle2f, circle2f_intersect, line2f_intersect, Ray2f, ray2f_evaluate, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_lerp, vec2f_minus, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect, vec2f_sub, Vector2f } from '../rt/math';
import { PSSMLT } from '../rt/pssmlt';
import { Captions } from '../common/captions';
import { FakeRandom, findGuidePaths, FocalHighlight, linear_lookup, linspace, polar_plot, sample, saturate, StratifiedRandom, theta_linspace } from '../common/guiding';
import { alpha, colors } from '../common';

function array_equals<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
}

export function isCDSL(path: PathVertex[]) {
    return array_equals(path.map(p => p.type), [
        PathVertexType.Camera,
        PathVertexType.Diffuse,
        PathVertexType.Specular,
        PathVertexType.Light
    ])
}

const captions = createRef<Captions>()

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
        yield* $.cbox.pathvis.fadeInPath(id, 0.7)
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

    function* showSubpath(subPath: Path) {
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
                stroke: isVisible ?
                    colors.white :
                    colors.red
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
        captions().updateTitle("Photon mapping"),
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
    view: Node
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
            path[0].p = $.cbox.camera.center;
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
    const fhCam = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhCam}
        position={$.cbox.camera.center}
    />)
    yield* all(
        fhCam().opacity(1, 1),
        $.cbox.cameraNode.opacity(0.3, 1),
        ...segments
            .filter(s => !s.isNEE && !s.isHelper)
            .map(s =>
                s.node.opacity(s.isCamera ? 1 : 0.2, 1)
            )
    )

    yield* waitUntil('pt/virt')
    const fhCamVirt = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhCamVirt}
        position={$.cbox.mirroredCamera.center}
    />)
    const prevY = $.view.y();
    yield* all(
        $.view.y(prevY + 100, 1),
        fhCam().opacity(0, 1),
        fhCamVirt().opacity(1, 1),
        $.cbox.cameraNode.opacity(1, 1),
        ...segments
            .filter(s => !s.isNEE)
            .map(s =>
                s.node.opacity(
                    s.isSpecular && s.isCamera || s.wasSpecular ?
                    1 : 0.2, 1
                )
        )
    )

    yield* waitFor(2)

    yield* all(
        $.view.y(prevY, 1),
        fhCamVirt().opacity(0, 1),
        ...segments
            .filter(s => !s.isNEE)
            .map(s =>
                s.node.opacity(s.isHelper ? 0 : 0.2, 1)
            )
    )
    
    yield* waitUntil('pt/nee')
    yield* captions().updateReference("Next event estimation")
    const neeIds: number[] = []
    for (const segment of segments) {
        if (!segment.isNEE) continue
        neeIds.push($.cbox.pathvis.showPath([
            { p: segment.a.p },
            { p: $.cbox.light.center }
        ], {
            lineDash: [8,8]
        }))
    }
    const fhLight = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhLight}
        position={$.cbox.light.center}
    />)
    yield* all(
        $.cbox.lightNode.opacity(0.3, 1),
        fhLight().opacity(1, 1),
        ...segments.map(s =>
            s.node.opacity(
                s.isHelper ? 0 :
                s.isNEE ? 0 :
                0.2
            , 1)
        ),
        $.cbox.pathvis.fadeInPaths(neeIds, 1),
    )

    yield* waitUntil('pt/mnee')
    const mneeIds: number[] = []
    for (const segment of segments) {
        if (!segment.isNEE) continue
        const start = segment.a.p
        const end = $.cbox.mirroredLight.center
        const d = vec2f_direction(start, end)
        const mend = $.cbox.light.center
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
        mneeIds.push($.cbox.pathvis.showPath([
            { p: start },
            { p: mid },
            { p: end }
        ], {
            lineDash: [8,8],
            opacity: 0.3
        }))
    }
    const fhLightVirt = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhLightVirt}
        position={$.cbox.mirroredLight.center}
    />)
    yield* all(
        captions().updateReference("Manifold NEE [Hanika et al. 2015; Zeltner et al. 2020]"),
        fhLight().opacity(0, 1),
        ...neeIds.map(id => $.cbox.pathvis.getPath(id).opacity(0.2, 1)),
        ...segments.map(s =>
        s.node.opacity(
            s.isHelper ? 0 :
            s.isNEE ? 0 :
            0.2
        , 1))
    )
    yield* all(
        delay(0.4, fhLightVirt().opacity(1, 1)),
        $.cbox.pathvis.fadeInPaths(mneeIds, 1),
    );

    yield* waitUntil('pt/done')
    yield* all(
        fhLightVirt().opacity(0, 1),
        $.cbox.lightNode.opacity(1, 1),
        $.cbox.pathvis.fadeAndRemove(1),
    );
}

function* lighttrace($: {
    cbox: CBox
    numPaths: number
    view: Node
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
            path[0].p = $.cbox.light.center
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
    const fhLight = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhLight}
        position={$.cbox.light.center}
    />)
    yield* all(
        $.cbox.lightNode.opacity(0.3, 1),
        fhLight().opacity(1, 1),
        ...segments
            .filter(s => !s.isHelper)
            .map(s =>
                s.node.opacity(s.isLight ? 1 : 0.2, 1)
            )
    )

    yield* waitUntil('lt/virt')
    const fhLightVirt = createRef<FocalHighlight>();
    $.view.add(<FocalHighlight
        ref={fhLightVirt}
        position={$.cbox.mirroredLight.center}
    />)
    yield* all(
        fhLight().opacity(0, 1),
        fhLightVirt().opacity(1, 1),
        $.cbox.lightNode.opacity(1, 1),
        ...segments.map(s =>
            s.node.opacity(
                s.isSpecular && s.isLight || s.wasSpecular ?
                1 : 0.2, 1
            )
        )
    )

    yield* waitUntil('lt/miss')
    yield* all(
        fhLightVirt().opacity(0, 1),
        ...segments.map(s =>
            s.node.opacity(
                s.isHelper ? 0 :
                s.isMiss ? 1 :
                0.2
            , 1)
        )
    )

    yield* waitUntil('lt/done')
    yield* all(
        $.cbox.pathvis.fadeAndRemove(1),
        captions().reset()
    )
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

function showGuidedSampling($: {
    origin: SimpleSignal<Vector2f>
    target: SimpleSignal<Vector2f>
    opacity: SimpleSignal<number>
    light: Circle2f
    add(n: Node): void
}) {
    const t = createSignal(0)
    const props: RayProps = {
        opacity: $.opacity,
        lineWidth: 4,
        stroke: colors.green,
        zIndex: 50,
    }
    $.add(<Ray
        from={$.origin}
        to={() => vec2f_lerp($.origin(), $.target(),
            Math.min(2 * t(), 1)
        )}
        {...props}
    />)

    const reflect = () => vec2f_reflect(vec2f(0, -1), vec2f_minus(
        vec2f_direction($.origin(), $.target())
    ))
    const ray = (): Ray2f => ({
        o: $.target(),
        d: reflect()
    })
    const hit = () => circle2f_intersect($.light, ray())
    const end = () => ray2f_evaluate(ray(), isFinite(hit()) ? hit() : 150)
    $.add(<Ray
        from={$.target}
        to={() => vec2f_lerp($.target(), end(),
            $.target().y < -295 ? Math.max(2 * t() - 1, 0) : 0
        )}
        {...props}
    />)
    return t(1, 1)
}

let guidePaths: Path[]
const hitpoint = createSignal<Vector2f>()

function* guiding($: {
    cbox: CBox
    view: Node
}) {
    const pathvis = $.cbox.pathvis
    const view = <Layout zIndex={10} />
    $.view.add(view)

    const centralPaths: number[] = []
    for (const path of findGuidePaths($.cbox).filter(isCDSL)) {
        if (centralPaths.length === 0) {
            // first path, show extra path for camera segment
            hitpoint(path[1].p)
            const helpId = pathvis.showPath(path.slice(0, 2))
            yield* pathvis.fadeInPath(helpId, 1)
        }

        centralPaths.push(pathvis.showPath(path.slice(1), { opacity: 0.3 }))
    }

    yield* pathvis.fadeInPaths(centralPaths, 1)

    yield* waitUntil('guiding/title')
    yield* all(
        captions().updateTitle("Path guiding"),
        captions().updateReference("[Vorba et al. 2014; Müller et al. 2017]")
    )

    yield* waitUntil('guiding/dist')
    const guidingDistRes = 512
    const guidingUniform = createSignal(1)
    const guidingBrokenTarget = createSignal(false)
    const guidingDist = createSignal<number[]>(() => {
        const targets = guidingBrokenTarget() ?
        [
            { d: vec2f_normalized(vec2f(-1, -1.10)), exp: 5, w: 1.7 },
            //{ d: vec2f_normalized(vec2f(-1,  1.60)), exp: 6 , w: 0.5 },
        ] :
        [
            { d: vec2f_normalized(vec2f(-1, -1.15)), exp: 180, w: 1 },
            //{ d: vec2f_normalized(vec2f(-1, -0.48)), exp: 180, w: 1 },
            //{ d: vec2f_normalized(vec2f(-1,  1.60)), exp: 6  , w: 0.5 },
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
    //yield* guidingUniform(0, 2)

    yield* waitUntil('guiding/sampling')
    const numGuidingSamples = 9
    const guidingSamples = createSignal(() => {
        const rngs = linspace(numGuidingSamples)
        const newDist = guidingDist().map(x => Math.pow(x, 2))
        return sample(newDist, rngs).map(i => vec2f_polar(
            theta_linspace(i, guidingDistRes), Math.sqrt(
                linear_lookup(newDist, i)
            )
        ))
    })
    const gsView = <Layout />;
    view.add(gsView)
    function* showGuiding() {
        gsView.removeChildren()
        gsView.opacity(1)
        yield* all(
            pathvis.opacity(0.1, 1),
            ...guidingSamples().map((_, i) => {
                const ray = (): Ray2f => ({
                    o: hitpoint(),
                    d: guidingSamples()[i]
                })
                const hit = () => ray().d.y < -0.3 ? Math.min(
                    (-ray().o.y - 300) / ray().d.y
                    , 700
                ) : 200
                return showGuidedSampling({
                    add: n => gsView.add(n),
                    light: $.cbox.light,
                    opacity: createSignal(i === 4 ? 1 : 0.3),
                    origin: hitpoint,
                    target: createSignal(() =>
                        ray2f_evaluate(ray(), hit())
                    )
                })
            })
        )
    }
    yield* guidingUniform(0, 2)
    yield* showGuiding()

    yield* waitUntil('guiding/parallax')
    const spatialExtent = createSignal(0)

    const pathsToBeHidden = shuffle([...centralPaths]).slice(2)
    yield* all(
        ...pathsToBeHidden.map(id =>
            pathvis.getPath(id).opacity(0, 1))
    )
    pathvis.removePaths(pathsToBeHidden)
    yield* all(
        gsView.opacity(0, 1),
        pathvis.opacity(1, 1),
        guidingPlot.opacity(0, 1),
    )
    const neighboringPaths: number[] = []
    const directionsView = <Layout opacity={0} />
    const directionsMerge = createSignal(0)
    const parallaxCompensation = createSignal(0)
    guidePaths = findGuidePaths($.cbox, {
        spread: 20,
        candidates: 700,
        seed: 9,
    }).filter(isCDSL)
    for (const path of guidePaths) {
        const id = pathvis.showPath(path, { opacity: 0.2, visible: true })
        const dist = vec2f_distance(path[1].p, hitpoint())
        pathvis.getPath(id).opacity(createSignal(() =>
            saturate((spatialExtent() - dist) / 10)
        ))
        neighboringPaths.push(id)

        const direction = vec2f_direction(path[1].p, path[2].p)
        let parallaxDistance = 0
        for (let i = 2; i < path.length; i++) {
            parallaxDistance += vec2f_distance(path[i-1].p, path[i].p)
            if (path[i].type === PathVertexType.Diffuse) break
        }
        const parallaxPoint = ray2f_evaluate(
            { o: path[1].p, d: direction }, parallaxDistance
        )
        const rayPos = () => vec2f_lerp(path[1].p, hitpoint(), directionsMerge())
        const parallaxDirection = () => vec2f_direction(rayPos(), parallaxPoint)
        const rayTo = () => vec2f_multiply(
            vec2f_lerp(direction, parallaxDirection(), parallaxCompensation())
        , 80)
        const rayTarget = () => vec2f_add(rayTo(), rayPos())
        directionsView.add(<Ray
            from={[0,0]}
            to={rayTo}
            position={rayPos}
            stroke={colors.white}
            lineWidth={3}
            arrowSize={8}
            opacity={0.8}
            endArrow
        />)
        directionsView.add(<Ray
            from={rayTarget}
            to={() => vec2f_lerp(rayTarget(), parallaxPoint, parallaxCompensation())}
            stroke={colors.white}
            lineWidth={3}
            arrowSize={8}
            opacity={() => 0.4 * parallaxCompensation()}
            lineDash={[3,3]}
        />)
    }
    yield* waitUntil('guiding/neighbors')
    yield* spatialExtent(150, 3)
    view.add(directionsView)
    
    yield* waitUntil('guiding/dir1')
    yield* directionsView.opacity(1, 1)
    yield* directionsMerge(1, 2)

    guidingBrokenTarget(true)
    guidingUniform(1)
    yield* all(
        guidingPlot.opacity(1, 1),
        guidingUniform(0, 1),
        showGuiding(),
    )
    yield* waitFor(1)
    yield* waitUntil('guiding/dir2')
    yield* all(
        gsView.opacity(0, 1),
        pathvis.opacity(1, 1),
        guidingPlot.opacity(0, 1),
        directionsMerge(0, 1),
        captions().updateReference("Parallax compensation [Ruppert et al. 2020]"),
    )
    yield* all(
        parallaxCompensation(1, 1),
        pathvis.opacity(0.5, 1),
    )
    const distanceLabel = <Layout
        rotation={48}
        position={[185,-245]}
        opacity={0}
    >
        <Img
            src={"svg/ThinBraceDown.svg"}
            size={[425,20]}
            rotation={180}
        />
        <Txt
            text={"?"}
            scaleX={-1}
            y={-40}
            fontSize={40}
            fill={"#69C63D"}
        />
    </Layout>;
    view.add(distanceLabel)
    yield* directionsMerge(1, 2)

    guidingBrokenTarget(false)
    yield* all(
        guidingPlot.opacity(1, 1),
        showGuiding()
    )
    yield* waitFor(1)
    yield* distanceLabel.opacity(1, 1)

    yield* waitUntil('guiding/done')
    yield* all(
        view.opacity(0, 2),
        pathvis.opacity(1, 1),
        //pathvis.fadeAndRemove(2),
    )
    
    view.remove()
}

function* psGuiding($: {
    cbox: CBox
    view: Node
}) {
    const distColor = colors.blue
    const condDistColor = colors.green

    function add(n: Node) {
        $.view.add(n)
        return n
    }

    const dots: Node[] = []
    for (const path of guidePaths) {
        for (let i = 1; i < path.length-1; i++) {
            const dot = <Layout position={path[i].p} opacity={0}>
                <Circle
                    size={30}
                    fill={distColor}
                    opacity={0.3}
                />
                <Circle
                    size={15}
                    fill={distColor}
                />
            </Layout>
            dots.push(dot)
            $.view.add(dot)
        }
    }
    yield* sequence(0.05, ...dots.map(dot =>
        all(
            dot.opacity(1, 0.5),
            dot.scale(2, 0.25).to(1, 0.25),
        )
    ));

    const hitpointCeiling = vec2f(95, -300)
    const distributionT = createSignal(0)
    const conditionalT = createSignal(0)
    const hitpointT = createSignal(0.5)
    const hitpointConditional = createSignal<Vector2f>(() =>
        vec2f_add(hitpointCeiling, vec2f((hitpointT() - 0.5) * 65, 0))
    )

    const p0 = (x: number) => vec2f( 25 * Math.exp(-7 * Math.pow(x, 2)) + 10, 200 * x)
    const p1 = (x: number) => vec2f(150 * x, - 40 * Math.exp(-7 * Math.pow(x, 2)) - 10)
    const pc = (x: number) => vec2f( 20 * x, -120 * Math.exp(-7 * Math.pow(x, 2)) - 10)

    const gaussX = linspace(256).map(x => 2 * x - 1)
    const distP0 = add(<Line
        position={hitpoint()}
        opacity={distributionT}
        scaleX={distributionT}
        points={gaussX.map(p0)}
        stroke={new Gradient({
            from: [ 0, -150 ],
            to: [ 0, 150 ],
            stops: [
                { color: alpha(distColor, 0), offset: 0 },
                { color: distColor, offset: 0.3 },
                { color: distColor, offset: 0.7 },
                { color: alpha(distColor, 0), offset: 1 },
            ]
        })}
        lineWidth={4}
        fill={alpha(distColor, 0.2)}
    />)
    const distP1 = add(<Line
        position={hitpointCeiling}
        opacity={() => distributionT() - 0.2 * conditionalT()}
        scaleY={distributionT}
        points={gaussX.map(p1)}
        stroke={new Gradient({
            from: [ -120, 0 ],
            to: [ 120, 0 ],
            stops: [
                { color: alpha(distColor, 0), offset: 0 },
                { color: distColor, offset: 0.3 },
                { color: distColor, offset: 0.7 },
                { color: alpha(distColor, 0), offset: 1 },
            ]
        })}
        lineWidth={4}
        fill={alpha(distColor, 0.2)}
    />)
    const distPcond = add(<Line
        position={hitpointConditional}
        opacity={conditionalT}
        points={() => gaussX.map(x => vec2f_lerp(p1(x), pc(x), conditionalT()))}
        stroke={new Gradient({
            from: [ -25 - (1 - conditionalT()) * 50, 0 ],
            to: [ 25 + (1 - conditionalT()) * 50, 0 ],
            stops: [
                { color: alpha(condDistColor, 0), offset: 0 },
                { color: condDistColor, offset: 0.3 },
                { color: condDistColor, offset: 0.7 },
                { color: alpha(condDistColor, 0), offset: 1 },
            ]
        })}
        lineWidth={4}
        fill={alpha(condDistColor, 0.2)}
    />)

    yield* waitUntil('psg/dist')
    yield* distributionT(1, 2)
    yield* conditionalT(1, 1)

    const hitpointQuery = createSignal<Vector2f>(() =>
        vec2f_add(hitpoint(), vec2f(0, 120 - hitpointT() * 240)))
    const cameraSegment = add(<Ray
        from={$.cbox.camera.center}
        to={hitpointQuery}
        stroke={colors.yellow}
        lineWidth={4}
        arrowSize={12}
        endArrow
    />)

    yield* waitUntil('psg/correl')
    const condPoints = linspace(9).map(x => -Math.log(1 / x - 1))
    yield* all(
        $.cbox.pathvis.opacity(0.1, 1),
        ...condPoints.map(p => showGuidedSampling({
            add,
            light: $.cbox.light,
            opacity: createSignal(p === 0 ? 1 : 0.3),
            origin: hitpointQuery,
            target: createSignal(() =>
                vec2f_add(hitpointConditional(), vec2f(10 * p, 0))
            )
        }))
    )
    yield* hitpointT(1, 2).to(0, 4).to(0.5, 2)

    yield* waitUntil('psg/done')
}

export default makeScene2D(function* (originalView) {
    originalView.add(<Captions
        ref={captions}
        chapter=""
    />);

    const view = makeCBoxView();
    originalView.add(view)

    const cbox = new CBox(view)
    cbox.cameraSpread = 90
    cbox.draw()
    
    cbox.cameraNode.scale(0)
    yield* all(
        captions().chapter("Previous works", 1),
        cbox.cameraNode.scale(1, 1),
    );

    yield* waitUntil('lts/pt')
    yield* all(
        captions().updateTitle("Path tracing"),
        captions().updateReference("[Kajiya 1986]")
    )
    yield* pathtraceSingle({ cbox })
    yield* pathtrace({ view, cbox, useNEE: true, numPaths: 16 })
    yield* captions().reset()

    yield* waitUntil('lts/lt')
    yield* captions().updateTitle("Light tracing")
    yield* lighttraceSingle({ cbox })
    yield* lighttrace({ view, cbox, numPaths: 18 })

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
    yield* guiding({ cbox, view })
    yield* captions().reset()

    yield* waitUntil('lts/psGuiding')
    yield* all(
        captions().updateTitle("Path space guiding"),
        captions().updateReference("[Reibold et al. 2018; Schüßler et al. 2022; Li et al. 2022]")
    )
    yield* psGuiding({ cbox, view })

    yield* waitUntil('lts/done')
    yield* all(
        captions().reset(),
        captions().chapter("", 1),
        view.opacity(0, 1),
    );
});
