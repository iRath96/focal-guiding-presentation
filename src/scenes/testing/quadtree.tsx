import { Line, Ray, makeScene2D } from '@motion-canvas/2d'
import { Line2f, Ray2f, line2f_intersect, vec2f, vec2f_add, vec2f_multiply, vec2f_normalized } from '../rt/math'
import { waitFor } from '@motion-canvas/core'
import { QuadTree  } from '../rt/quadtree'
import { QuadtreeVisualizer } from '../ui/quadtree'
import { colors } from '../common'

export default makeScene2D(function* (view) {
    const quadtree = new QuadTree({
        min: vec2f(-400, -400),
        max: vec2f(400, 400),
    }, 4, 16, 0.02);
    const visualizer = new QuadtreeVisualizer(view, quadtree);

    const ray: Ray2f = {
        o: vec2f(-180, 80),
        d: vec2f_normalized(vec2f(0.8, -0.2)),
    }
    const line: Line2f = {
        from: vec2f(500, -400),
        to: vec2f(500, 400)
    }

    const endT = line2f_intersect(line, ray)
    for (const t of quadtree.traverse(ray)) {
        const contrib = (t.t1 - t.t0) / endT
        t.patch.node.accumulator += contrib
    }

    view.add(
        <Line
            points={[ line.from, line.to ]}
            stroke={colors.white}
            lineWidth={4}
        />
    )

    view.add(
        <Ray
            from={ray.o}
            to={vec2f_add(ray.o, vec2f_multiply(ray.d, endT))}
            stroke={colors.white}
            lineWidth={8}
            endArrow
        />
    )

    yield* visualizer.show()

    //

    quadtree.minDepth = 0
    quadtree.rebuild()

    const hit = new Set<number>()
    for (const t of quadtree.traverse(ray)) {
        //console.log(t)
        if (t.t1 < 0) continue
        hit.add(t.patch.node.id)
    }

    yield* visualizer.show()

    yield* waitFor(1)
});
