import { Layout, makeScene2D } from '@motion-canvas/2d';
import { createRef, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { Captions } from '../common/captions';
import { findGuidePaths } from '../common/guiding';
import { QuadTree } from '../rt/quadtree';
import { Ray2f, vec2f, vec2f_direction } from '../rt/math';
import { QuadtreeVisualizer } from '../ui/quadtree';
import { path_segments } from '../ui/path';

const captions = createRef<Captions>()

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

    //const paths = findGuidePaths(cbox, 15, 350, 10)
    const paths = findGuidePaths(cbox, 45, 3*350, 10)
    for (const path of paths) {
        cbox.pathvis.showPath(path, { opacity: 0.3, visible: true })
    }

    const quadtree = new QuadTree({
        min: vec2f(-435-82, -435-55),
        max: vec2f( 435-82,  435-55),
    }, 4, 16, 0.01);
    const visualizer = new QuadtreeVisualizer(view, quadtree);
    visualizer.gridOpacity = 0.5
    visualizer.maxDensity = 10

    yield* captions().showTransition("Our approach", 8)
    yield* visualizer.show()

    for (const path of paths) {
        for (const [a,b] of path_segments(path)) {
            const ray: Ray2f = {
                o: a.p,
                d: vec2f_direction(a.p, b.p),
            }
            for (const t of quadtree.traverse(ray)) {
                const contrib = (t.t1 - t.t0) * (
                    t.patch.density + 1e-4)
                t.patch.node.accumulator += contrib
            }
        }
    }

    yield* waitFor(1)
    quadtree.rebuild()
    yield* visualizer.show()
    yield* waitFor(1)
    quadtree.minDepth = 0
    quadtree.refine()
    yield* visualizer.show()
    
    yield* waitFor(100)
    yield* waitUntil('ours/done')
});
