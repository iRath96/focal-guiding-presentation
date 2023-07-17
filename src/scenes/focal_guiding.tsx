import { Circle, Line, View2D, makeScene2D } from '@motion-canvas/2d'
import { Circle2f, Curve2f, Line2f, Ray2f, circle2f_intersect, curve2f_intersect, curve2f_normal, curve2f_rasterize, line2f_evaluate, line2f_intersect, line2f_normal, ray2f_evaluate, vec2f, vec2f_add, vec2f_direction, vec2f_multiply, vec2f_polar, vec2f_refract, vec3f } from '../rt/math'
import { Random, waitFor } from '@motion-canvas/core'
import { QuadTree  } from '../rt/quadtree'
import { QuadtreeVisualizer } from '../ui/quadtree'
import { PathVertex, PathVertexType, PathVisualizer } from '../ui/path'

interface Lens {
    a: Line2f
    b: Curve2f
    ior: number
}

function makeLens(view: View2D): Lens {
    const curvature = 0.3
    const y = -150
    const line: Line2f = {
        from: vec2f(100, y),
        to: vec2f(-100, y)
    }
    const curve: Curve2f = {
        t: {
            x: vec3f(100,0,0),
            y: vec3f(0,100,y),
            z: vec3f(0,0,1),
        },
        c0: 1.2 * curvature,
        c2: -curvature,
        c4: 0.08 * curvature,
    }

    view.add(<Line
        points={() => [
            ...curve2f_rasterize(curve, 64),
            line.from, line.to
        ]}
        closed
        fill="rgba(59, 91, 255, 0.5)"
        stroke="rgb(59, 91, 255)"
        lineWidth={4}
        zIndex={2}
    />)

    return {
        a: line,
        b: curve,
        ior: 3
    }
}

export default makeScene2D(function* (view) {
    const pathvis = new PathVisualizer(view)
    const prng = new Random(1337)
    const light: Circle2f = {
        center: vec2f(0, -300),
        radius: 15
    }
    const cameraPos = vec2f(-300, 0)
    const lens = makeLens(view)
    const floor: Line2f = {
        from: vec2f(-200, 300),
        to: vec2f(200, 300),
    }

    function pathtrace(nextFloat: () => number): PathVertex[] {
        function exit() {
            path.push({
                p: ray2f_evaluate(ray, 2000),
                type: PathVertexType.Miss
            })
            return path
        }

        // at camera
        let ray: Ray2f = {
            o: cameraPos,
            d: vec2f_direction(cameraPos,
                line2f_evaluate(floor, nextFloat()))
        }
        const path: PathVertex[] = [{
            p: ray.o,
            type: PathVertexType.Camera,
        }]
        const isect = line2f_intersect(floor, ray)
        if (!isFinite(isect)) return exit()

        // at floor
        ray.o = ray2f_evaluate(ray, isect)
        ray.d = vec2f_polar(nextFloat() * -Math.PI)
        path.push({
            p: ray.o,
            type: PathVertexType.Diffuse,
        })
        const isect2 = curve2f_intersect(lens.b, ray)
        if (!isFinite(isect2.t)) return exit()

        // in lens
        const normal = curve2f_normal(lens.b, isect2.x)
        ray.o = ray2f_evaluate(ray, isect2.t)
        ray.d = vec2f_refract(normal, ray.d, 1/lens.ior)
        path.push({
            p: ray.o,
            type: PathVertexType.Specular,
        })
        const isect3 = line2f_intersect(lens.a, ray)
        if (!isFinite(isect3)) return exit()

        // in lens
        const normal2 = vec2f_multiply(line2f_normal(lens.a), -1)
        ray.o = ray2f_evaluate(ray, isect3)
        ray.d = vec2f_refract(normal2, ray.d, lens.ior)
        path.push({
            p: ray.o,
            type: PathVertexType.Specular,
        })
        const isect4 = circle2f_intersect(light, ray)
        if (!isFinite(isect4)) return exit()

        // end
        path.push({
            p: ray2f_evaluate(ray, isect4),
            type: PathVertexType.Light,
        })

        return path
    }

    view.add(<Circle
        position={light.center}
        size={2 * light.radius}
        fill={"#ffaa00"}
        zIndex={4}
    />)
    view.add(<Circle
        position={cameraPos}
        size={20}
        fill={"#00aaff"}
        zIndex={4}
    />)
    view.add(<Line
        points={[ floor.from, floor.to ]}
        stroke="#ffffff"
        lineWidth={8}
    />)

    const pssmlt = new class {
        private prng = new Random(123)
        public stepSize = 0.1
        private rnd: {
            v: number // base
            m: number // mutated
            a: boolean
        }[] = []
        private index = 0

        nextFloat() {
            if (this.index >= this.rnd.length) {
                const m = prng.nextFloat()
                this.rnd.push({ v: 0, m, a: false })
                return m
            }

            const r = this.rnd[this.index++]
            if (r.a) {
                r.m = r.v + this.stepSize * (2 * prng.nextFloat() - 1)
                if (r.m > 1) r.m -= 1
                if (r.m < 0) r.m += 1
            } else {
                r.m = prng.nextFloat()
            }
            return r.m
        }

        accept() {
            for (const r of this.rnd) {
                r.v = r.m
                r.a = true
            }
            this.index = 0
        }

        reject() {
            this.index = 0
        }
    }()

    pssmlt.stepSize = 0.05

    let lastAcceptId = -1
    let lastRejectId = -1
    for (let i = 0; i < 100; i++) {
        const path = pathtrace(() => pssmlt.nextFloat())
        const success =
            path[path.length - 1].type == PathVertexType.Light &&
            (lastAcceptId < 0 || Math.random() > 0.9)
        if (success) {
            pssmlt.accept()
        } else {
            pssmlt.reject()
        }
        
        const pathId = pathvis.showPath(path)
        if (success) {
            pathvis.removePath(lastAcceptId)
            pathvis.removePath(lastRejectId)
            lastAcceptId = pathId

            yield *waitFor(0.5)
        } else {
            pathvis.removePath(lastRejectId)
            lastRejectId = pathId

            yield //*waitFor(0.01)
        }
        //break
    }

    return

    const quadtree = new QuadTree({
        min: vec2f(-380, -400),
        max: vec2f(380, 360),
    }, 3, 7, 0.01);
    const visualizer = new QuadtreeVisualizer(view, quadtree);
    visualizer.maxDensity = 30

    yield* visualizer.show()
    
    for (let iteration = 0; iteration < 3; iteration++) {
        for (let i = 0; i < 5000; i++) {
            const path = pathtrace(() => prng.nextFloat())
            if (path[path.length - 1].type != PathVertexType.Light)
                continue
            //pathvis.showPath(path)

            for (let i = 1; i < path.length; i++) {
                if (i != 2) continue
                const ray: Ray2f = {
                    o: path[i-1].p,
                    d: vec2f_direction(path[i-1].p, path[i].p),
                }
                for (const t of quadtree.traverse(ray)) {
                    const contrib = (t.t1 - t.t0) * (
                        t.patch.density + 1e-4)
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
    }

    yield* waitFor(1)
});
