import { Layout, makeScene2D } from '@motion-canvas/2d';
import { createRef, waitFor, waitUntil } from '@motion-canvas/core';
import { CBox } from '../common/cbox';
import { Captions } from '../common/captions';
import { findGuidePaths } from '../common/guiding';
import { QuadTree } from '../rt/quadtree';
import { vec2f } from '../rt/math';
import { QuadtreeVisualizer } from '../ui/quadtree';

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

    const paths = findGuidePaths(cbox, 15, 350, 10)
    for (const path of paths) {
        cbox.pathvis.showPath(path, { opacity: 0.3, visible: true })
    }

    const quadtree = new QuadTree({
        min: vec2f(-435-82, -435-55),
        max: vec2f( 435-82,  435-55),
    }, 4, 16, 0.02);
    const visualizer = new QuadtreeVisualizer(view, quadtree);
    visualizer.gridOpacity = 0.5

    yield* captions().showTransition("Our approach", 8)
    yield* visualizer.show()
    
    yield* waitFor(100)
    yield* waitUntil('ours/done')
});
