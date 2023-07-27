import { Circle, Layout, Line, makeScene2D, Node, Ray } from '@motion-canvas/2d';
import { all, chain, createRef, debug, delay, Random, Reference, sequence, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { Captions } from '../common/captions';
import { findGuidePaths } from '../common/guiding';
import { QuadTree } from '../rt/quadtree';
import { Ray2f, Vector2f, bounds2f_center, bounds2f_evaluate, circle2f_towards, ray2f_evaluate, ray2f_targeting, vec2f, vec2f_add, vec2f_copy, vec2f_direction, vec2f_distance, vec2f_multiply, vec2f_reflect } from '../rt/math';
import { QuadtreeVisualizer } from '../ui/quadtree';
import { Path, PathVertex, PathVertexType, path_segments } from '../ui/path';
import { colors } from '../common';

const captions = createRef<Captions>()

function sgmt(tFar: number, tNear: number) {
    return tFar * tFar - tNear * tNear
}

function* hierarchical($: {
    cbox: CBox
    quadtree: QuadTree
    qvis: QuadtreeVisualizer
    view: Node
}) {
    const pathvis = $.cbox.pathvis

    // shoot ray
    const wallHit = vec2f(300, 70)
    yield* pathvis.fadeInPath(pathvis.showPath([
        { p: circle2f_towards($.cbox.camera, wallHit) },
        { p: wallHit, type: PathVertexType.Diffuse }
    ]), 1)

    yield* waitUntil('warping')
    yield* pathvis.opacity(0.3, 1)

    const prng = new Random(1234)
    const points: Vector2f[] = []
    const Nres = 16
    for (let x = 0; x < Nres; x++) {
        for (let y = 0; y < Nres; y++) {
            const jitter = vec2f(prng.nextFloat(), prng.nextFloat())
            points.push(vec2f_multiply(vec2f_add(vec2f(x, y), jitter), 1 / Nres))
        }
    }
    //debug([...$.quadtree.warp(vec2f(0.5, 0.5))])
    const unimportant: Node[] = [];
    let sampledFocalPoint: Vector2f;
    yield* all(...points.map((point, i) => {
        const highlight = i === 136
        const size = highlight ? 32 : 6
        const circle = createRef<Circle>()
        const node = <Circle
            ref={circle}
            position={bounds2f_evaluate($.quadtree.bounds, vec2f(0.5, 0.5))}
            size={size}
            opacity={1}//highlight ? 1 : 0.7}
            fill={highlight ? colors.white : colors.green}
            stroke={colors.black}
            lineWidth={highlight ? 4 : 0}
            zIndex={highlight ? 10 : 0}
        />;
        $.view.add(node);
        const trajectory = [...$.quadtree.warp(point)];
        if (highlight) {
            sampledFocalPoint = trajectory[trajectory.length - 1];
        } else {
            unimportant.push(node)
        }
        //return waitFor(5)
        return sequence(1, ...trajectory.map((p, i) =>
            all(circle().position(p, 0.7), circle().size(size * Math.pow(0.83, i), 1))
        ))
    }))

    yield* all(...unimportant.map(c => c.opacity(0, 1)))
    for (const circle of unimportant) circle.remove();

    // connect to sampled point
    yield* waitUntil('shoot ray')
    yield* pathvis.opacity(1, 1)
    
    const ray = ray2f_targeting(wallHit, sampledFocalPoint)
    const isect = $.cbox.intersect(ray)
    yield* pathvis.fadeInPath(
        pathvis.showPath([
            { p: wallHit, type: PathVertexType.Diffuse },
            isect,
        ]), 1
    )
    yield* pathvis.fadeInPath(
        pathvis.showPath([
            isect,
            { p: sampledFocalPoint },
        ], {
            lineDash: [ 5, 5 ]
        }), 0.3
    )

    const ray2 = { o: isect.p, d: vec2f_reflect(isect.n, vec2f_multiply(ray.d, -1)) }
    const isect2 = $.cbox.intersect(ray2)
    yield* pathvis.fadeInPath(
        pathvis.showPath([
            isect,
            isect2,
        ]), 1
    )

    // show pdf
    yield* waitUntil('pdf')
    yield* all(
        pathvis.opacity(0.3, 1),
        //$.qvis.view.opacity(1, 1),
    )
    const hits = [...$.quadtree.traverse(ray)]
    yield* chain(...hits.map(function* (hit) {
        const node = <Ray
            from={ray2f_evaluate(ray, Math.max(hit.t0, 0))}
            to={ray2f_evaluate(ray, hit.t1)}
            stroke={colors.white}
            lineWidth={8}
            opacity={0}
        />
        $.view.add(node)
        yield* all(
            node.opacity(1, 0.25).to(0.3, 0.25),
            $.qvis.highlight(hit.patch.node.id)
        )
    }))
}

export default makeScene2D(function* (originalView) {
    originalView.add(<Captions
        ref={captions}
        chapter="Our approach"
    />);

    const view = <Layout
        position={[-350, 55]}
        scale={[ -1, 1 ]}
    />
    originalView.add(view)

    const cbox = new CBox(view)
    cbox.cameraSpread = 90
    cbox.draw()

    const paths = findGuidePaths(cbox, 90, 3000, 42)
    //for (const path of paths) {
    //    cbox.pathvis.showPath(path, { opacity: 0.3, visible: true })
    //}

    const quadtree = new QuadTree({
        min: vec2f(-435-82, -435-55),
        max: vec2f( 435-82,  435-55),
    }, 4, 6, 0.04);
    const quadtreeView = <Layout />
    view.add(quadtreeView)
    const visualizer = new QuadtreeVisualizer(quadtreeView, quadtree);
    visualizer.gridOpacity = 0.4
    visualizer.maxDensity = 1

    yield* captions().showTransition("Our approach", 8)

    yield* waitUntil('show grid')
    yield* visualizer.show()

    yield* waitUntil('splatting')
    const pathvis = cbox.pathvis
    const splatExamples = [
        paths[4],
        //paths[68],
        paths[83],
        paths[100],
        paths[114],
    ]
    const splatMass = (() => {
        const mass = new Map<Number, number>()
        return (id: number, v: number) => {
            if (!mass.has(id)) mass.set(id, 0)
            mass.set(id, v += mass.get(id))
            return v
        }
    })()
    for (const example of splatExamples) {
        const speed = 2000
        for (const [a,b] of path_segments(example)) {
            const pathId = pathvis.showPath([a,b])
            const ray = ray2f_targeting(a.p, b.p)
            const dist = vec2f_distance(a.p, b.p)
            const hits = [...quadtree.traverse(ray)].filter(hit => hit.t1 > 0)
            yield* all(
                pathvis.fadeInPath(pathId, dist / speed),
                ...hits.map(hit => delay(
                    hit.t0 / speed,
                    all(
                        visualizer.highlight(hit.patch.node.id),
                        visualizer.colorRect(hit.patch.node.id,
                            splatMass(hit.patch.node.id,
                                Math.max(0.003 * (hit.t1 - hit.t0), 0)
                            ), 0.5)
                    )
                ))
            )
        }
    }
    yield* pathvis.fadeAndRemove(1)

    for (let iter = 1; iter <= 3; iter++) {
        visualizer.maxDensity = 20 * Math.pow(iter - 0.2, 3)
        for (const path of paths) {
            for (const [a,b] of path_segments(path)) {
                const misF = (a.type === PathVertexType.Camera || b.type === PathVertexType.Light) ?
                    0.2 / Math.pow(iter, 2) :
                    1;

                const ray = ray2f_targeting(a.p, b.p)
                let pdf = 0
                for (const t of quadtree.traverse(ray)) {
                    if (t.t1 < 0) continue
                    pdf += t.patch.density * sgmt(t.t1, Math.max(t.t0, 0))
                }
                for (const t of quadtree.traverse(ray)) {
                    if (t.t1 < 0) continue
                    const pdfW = iter == 1 ?
                        t.t1 - Math.max(t.t0, 0) :
                        t.patch.density * sgmt(t.t1, Math.max(t.t0, 0)) / pdf
                    const fakeW = 1 / (10 + vec2f_distance(
                        bounds2f_center(t.patch.bounds),
                        cbox.mirroredLight.center
                    )) + 1 / Math.pow(iter, 7)
                    const contrib = misF * pdfW * fakeW
                    t.patch.node.accumulator += contrib
                }
            }
        }

        quadtree.rebuild()
        yield* visualizer.show()
        yield* waitFor(1)
        quadtree.minDepth = 0
        quadtree.refine()
        yield* visualizer.show()
        yield* waitFor(1)
    }
    
    yield* waitUntil('hierarchical')
    yield* quadtreeView.opacity(0.5, 1)
    yield* hierarchical({ cbox, quadtree, qvis: visualizer, view })
    yield* waitUntil('ours/done')
    yield* waitFor(100)
});
