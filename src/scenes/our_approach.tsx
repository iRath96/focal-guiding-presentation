import { Layout, makeScene2D } from '@motion-canvas/2d';
import { all, createRef, delay, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { Captions } from '../common/captions';
import { findGuidePaths } from '../common/guiding';
import { QuadTree } from '../rt/quadtree';
import { Ray2f, bounds2f_center, ray2f_targeting, vec2f, vec2f_direction, vec2f_distance } from '../rt/math';
import { QuadtreeVisualizer } from '../ui/quadtree';
import { PathVertexType, path_segments } from '../ui/path';

const captions = createRef<Captions>()

function sgmt(tFar: number, tNear: number) {
    return tFar * tFar - tNear * tNear
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
    }, 4, 7, 0.04);
    const visualizer = new QuadtreeVisualizer(view, quadtree);
    visualizer.gridOpacity = 0.5
    visualizer.maxDensity = 1

    yield* captions().showTransition("Our approach", 8)
    yield* visualizer.show()

    // show splatting
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
                        visualizer.getRect(hit.patch.node.id)
                            .scale(1.2, 0.5).to(1, 0.5),
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

    for (let iter = 1; iter <= 5; iter++) {
        visualizer.maxDensity = 20 * Math.pow(iter - 0.3, 2)
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
                    )) + 1 / Math.pow(iter, 5)
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
    
    yield* waitFor(100)
    yield* waitUntil('ours/done')
});
