import { Circle, Line, Ray, View2D, makeScene2D, Node } from '@motion-canvas/2d'
import { Circle2f, Curve2f, Line2f, Ray2f, Vector2f, circle2f_intersect, curve2f_intersect, curve2f_normal, curve2f_rasterize, line2f_intersect, line2f_normal, ray2f_evaluate, vec2f, vec2f_add, vec2f_direction, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect, vec2f_refract, vec3f } from '../rt/math'
import { Random, createSignal, debug, waitFor } from '@motion-canvas/core'
import { QuadTree  } from '../rt/quadtree'
import { QuadtreeVisualizer } from '../ui/quadtree'

interface Lens {
    a: Line2f
    b: Curve2f
    ior: number
}

function makeLens(view: View2D): Lens {
    const curvature = 0.3
    const y = -250
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

enum PathVertexType {
    Camera,
    Diffuse,
    Specular,
    Light,
}

interface PathVertex {
    p: Vector2f
    type: PathVertexType
}

interface PVPath {
    segments: Node[]
}

class PathVisualizer {
    private shownPaths = new Map<number, PVPath>()
    private nextId = 0
    
    constructor(
        private view: View2D
    ) {}

    showPath(path: PathVertex[]) {
        const pvp: PVPath = { segments: [] }
        for (let i = 1; i < path.length; i++) {
            const segment = <Line
                points={[ path[i-1].p, path[i].p ]}
                stroke="#ffffff"
                opacity={0.0}
                lineWidth={4}
                endArrow
                zIndex={2}
            />
            pvp.segments.push(segment)
            this.view.add(segment)
        }

        const id = this.nextId++
        this.shownPaths.set(id, pvp)
        return id
    }
}

export default makeScene2D(function* (view) {
    const pathvis = new PathVisualizer(view)
    const prng = new Random(1337)
    const light: Circle2f = {
        center: vec2f(0, -400),
        radius: 15
    }
    const cameraPos = vec2f(-300, -100)
    const lens = makeLens(view)
    const floor: Line2f = {
        from: vec2f(-200, 200),
        to: vec2f(200, 200),
    }

    function pathtrace(): PathVertex[] {
        function exit() {
            //path.push({ p: ray2f_evaluate(ray, 2000) })
            return path
        }

        // at camera
        let ray: Ray2f = {
            o: cameraPos,
            d: vec2f_polar(prng.nextFloat(0.54, 1.2))
        }
        const path: PathVertex[] = [{
            p: ray.o,
            type: PathVertexType.Camera,
        }]
        const isect = line2f_intersect(floor, ray)
        if (!isFinite(isect)) return exit()

        // at floor
        ray.o = ray2f_evaluate(ray, isect)
        ray.d = vec2f_polar(prng.nextFloat(-Math.PI, 0))
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

    const quadtree = new QuadTree({
        min: vec2f(-450, -500),
        max: vec2f(350, 300),
    }, 3, 7, 0.01);
    const visualizer = new QuadtreeVisualizer(view, quadtree);
    visualizer.maxDensity = 30

    yield* visualizer.show()

    for (let iteration = 0; iteration < 3; iteration++) {
        for (let i = 0; i < 5000; i++) {
            const path = pathtrace()
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

        quadtree.minDepth = 0
        quadtree.rebuild()
        yield* visualizer.show()
    }

    yield* waitFor(1)
});
