import {Circle, Line, Ray, View2D, makeScene2D, Node, Txt, Spline, Layout, Rect, Img, LineProps} from '@motion-canvas/2d';
import {Random, SimpleSignal, all, chain, createRef, createSignal, debug, delay, sequence, waitFor, waitUntil} from '@motion-canvas/core';
import { Circle2f, Curve2f, Line2f, Ray2f, Vector2f, circle2f_evaluate, circle2f_intersect, circle2f_normal, curve2f_intersect, curve2f_normal, curve2f_rasterize, line2f_evaluate, line2f_intersect, line2f_normal, ray2f_evaluate, sample_hemicircle, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_length, vec2f_lerp, vec2f_minus, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_refract, vec2f_sub, vec3f } from '../rt/math';
import { PathVertex, PathVertexType, PathVisualizer } from '../ui/path';

class CBox {
    public cameraNode: Node
    public lightNode: Node

    public walls: Line2f[] = [
        // main box
        { from: vec2f(-300, 300), to: vec2f( 300, 300) },
        //{ from: vec2f( 300, 300), to: vec2f( 300,-300) },
        //{ from: vec2f( 300,-300), to: vec2f(-300,-300) },

        // small box
        //{ from: vec2f(-90+150, 300), to: vec2f(-90+150, 120) },
        //{ from: vec2f(-90+150, 120), to: vec2f( 90+150, 120) },
        //{ from: vec2f( 90+150, 120), to: vec2f( 90+150, 300) },
    ]

    public light: Circle2f = {
        center: vec2f(0, -250),
        radius: 25
    }

    public camera: Circle2f = {
        center: vec2f(-500, 0),
        radius: 20
    }

    constructor(
        private view: Node
    ) {
    }

    draw() {
        for (const wall of this.walls) {
            this.view.add(<Line
                points={[ wall.from, wall.to ]}
                stroke={"#ffffff"}
                lineWidth={4}
            />)
        }
    }

    intersect(ray: Ray2f, ignoreCamera = true): PathVertex {
        let type = PathVertexType.Miss
        let p = ray2f_evaluate(ray, 2000)
        let n = vec2f_multiply(ray.d, -1)
        let minT = Infinity

        function consider(t: number) {
            if (t > 1 && t < minT) {
                minT = t
                p = ray2f_evaluate(ray, t)
                return true
            }
            return false
        }

        for (const wall of this.walls) {
            if (consider(line2f_intersect(wall, ray))) {
                n = line2f_normal(wall)
                type = PathVertexType.Diffuse
            }
        }

        if (consider(circle2f_intersect(this.light, ray))) {
            n = circle2f_normal(this.light, p)
            type = PathVertexType.Light
        }

        if (!ignoreCamera && consider(circle2f_intersect(this.camera, ray))) {
            n = circle2f_normal(this.camera, p)
            type = PathVertexType.Camera
        }

        if (vec2f_dot(n, ray.d) > 0) n = vec2f_minus(n)

        return { p, n, type }
    }

    pathtrace(
        nextFloat: () => number,
        useNEE = true
    ): PathVertex[][] {
        let ray: Ray2f = {
            o: this.camera.center,
            d: vec2f_polar((2 * nextFloat() - 1) * 0.8)
        }
        ray.o = ray2f_evaluate(ray, this.camera.radius)
        const path: PathVertex[] = [{
            p: ray.o,
            n: ray.d,
            type: PathVertexType.Camera,
        }]
        const paths: PathVertex[][] = []
        for (let i = 0; i < 10; i++) {
            const isect = this.intersect(ray)
            path.push(isect)
            if (isect.type === PathVertexType.Miss ||
                isect.type === PathVertexType.Light
            ) {
                // ignore directly visible lights
                if (path.length > 2) {
                    paths.push(path)
                }
                break
            }

            if (useNEE) {
                const neeD = vec2f_direction(isect.p, this.light.center)
                const neeP = vec2f_add(
                    this.light.center,
                    vec2f_multiply(neeD, -this.light.radius)
                )
                const neeRay: Ray2f = {
                    o: isect.p,
                    d: neeD,
                }
                const neeIsect = this.intersect(neeRay)
                if (vec2f_distance(neeIsect.p, neeP) < 1) {
                    paths.push([
                        ...path,
                        neeIsect
                    ])
                    //paths.push([
                    //    path[path.length - 1],
                    //    neeIsect
                    //])
                }
            }
            
            ray.o = isect.p
            ray.d = sample_hemicircle(isect.n, nextFloat())
        }
        return paths
    }
}

function knownBeforehandLabel(cbox: CBox, view: View2D) {
    const layout = <Layout
        position={vec2f_add(cbox.camera.center, vec2f(-40, -70))}
        zIndex={30}
    >
        <Spline
            points={[
                [-10,-70],
                [-10,-35],
                [0,0],
            ]}
            stroke={"#fff"}
            lineWidth={4}
            endArrow
            arrowSize={16}
        />
        <Spline
            points={[
                [0,-130],
                [100,-180],
                vec2f_add(
                    vec2f_sub(cbox.light.center, cbox.camera.center),
                    vec2f(0, 60)
                ),
            ]}
            stroke={"#fff"}
            lineWidth={4}
            endArrow
            arrowSize={16}
        />
        <Txt
            position={[0, -100]}
            text={"Known beforehand"}
            fill={"#fff"}
        />
    </Layout>;
    view.add(layout);
    layout.opacity(0);
    return layout
}

class Laser {
    public position = vec2f(250, 0)
    public target = vec2f(0, 300)
    public pathvis: PathVisualizer
    public node: Node
    private laser = createRef<Img>()

    private ids: number[] = []
    private t0 = createSignal(0)
    private t1 = createSignal(1)

    constructor(
        private view: Node
    ) {
        this.pathvis = new PathVisualizer(view)
        view.add(<Line
            points={[ vec2f(-300, 300), vec2f( 300, 300) ]}
            stroke={"#fff"}
            lineWidth={4}
        />)
    }

    *draw() {
        const dir = vec2f_sub(this.target, this.position)
        const rotation = Math.atan2(dir.y, dir.x) * 180 / Math.PI
        const size = 100
        this.node = <Layout
            position={this.position}
        >
            <Img
                ref={this.laser}
                size={100}
                position={vec2f_multiply(
                    vec2f_normalized(dir),
                    -0.29 * size
                )}
                rotation={rotation + 45}
                src={"svg/flashlight-svgrepo-com.svg"}
            />
            <Line
                points={() => [
                    vec2f_multiply(dir, this.t0()),
                    vec2f_multiply(dir, this.t1())
                ]}
                stroke={"#ff0000"}
                lineWidth={16}
                endArrow
                arrowSize={16}
            />
        </Layout>
        this.view.add(this.node)
        this.laser().scale(0)

        yield* this.laser().scale(1, 0.5)
        yield* this.node.rotation(0, 0).to(10, 0.2).to(-10, 0.2).to(0, 0.2)
        yield* this.t1(1, 0.5)
    }

    *drawReflection() {
        const numPaths = 14
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1)
            const off = vec2f_polar(Math.PI * (t + 1), 200)
            const point = vec2f_add(this.target, off)
            const path: PathVertex[] = [
                { type: PathVertexType.Diffuse, p: this.target, n: vec2f(0, 0) },
                { type: PathVertexType.Miss, p: point, n: vec2f(0, 0) },
            ]
            this.ids.push(this.pathvis.showPath(path))
        }

        yield* sequence(0.04, ...this.ids.map(id => this.pathvis.fadeInPath(id, 0.3)))
    }

    *hide() {
        yield* sequence(0.04, ...this.ids.map(id => this.pathvis.fadeOutPath(id, 0.3)))
        yield* this.laser().scale(0, 0.5)
        yield* this.t0(1, 0.5)
    }
}

class AnimatedLine {
    private node: Node
    private t0 = createSignal(0)
    private t1 = createSignal(0)

    constructor(
        private view: Node,
        public from: Vector2f,
        public to: Vector2f,
        public props: LineProps = {}
    ) {
    }

    *start(time: number) {
        this.node = <Line
            points={() => [
                vec2f_lerp(this.from, this.to, this.t0()),
                vec2f_lerp(this.from, this.to, this.t1()),
            ]}
            stroke={"#fff"}
            lineWidth={4}
            {...this.props}
        />
        this.view.add(this.node)
        yield* this.t1(1, time)
    }

    *end(time: number) {
        yield* this.t0(1, time)
    }
}

class Obstruction {
    private pathvis: PathVisualizer
    private ids: number[] = []
    private lines: AnimatedLine[] = []

    constructor(
        private view: Node,
    ) {
        this.pathvis = new PathVisualizer(view)
        view.add(<Line
            points={[ vec2f(-300, 300), vec2f( 300, 300) ]}
            stroke={"#fff"}
            lineWidth={4}
        />)
    }

    *draw() {
        const a: Line2f = {
            from: vec2f(-300, 0),
            to: vec2f(-10, 0),
        }
        const b: Line2f = {
            from: vec2f(10, 0),
            to: vec2f(300, 0),
        }
        const light: Line2f = {
            from: vec2f(-100, -200),
            to: vec2f( 100, -200),
        }
        this.lines.push(
            new AnimatedLine(this.view, a.from, a.to),
            new AnimatedLine(this.view, b.from, b.to),
            new AnimatedLine(this.view, light.from, light.to, {
                stroke: "#ffaa00",
                lineWidth: 8
            })
        )
        yield* chain(...this.lines.map(v => v.start(0.3)))

        // draw rays

        const targetY = 300
        const numRays = 15
        for (let i = 0; i < numRays; i++) {
            const t = 0.05 + 0.9 * i / (numRays - 1)
            const o = line2f_evaluate(light, t)
            const d = vec2f_direction(o, vec2f(0, 0))
            const end = ray2f_evaluate({ o, d }, (targetY - o.y) / d.y)

            this.ids.push(this.pathvis.showPath([
                { type: PathVertexType.Light, n: vec2f(0, 0), p: o },
                { type: PathVertexType.Diffuse, n: vec2f(0, 0), p: end },
            ]))
        }

        yield* sequence(0.04, ...this.ids.map(id => this.pathvis.fadeInPath(id, 0.5)))
    }

    *hide() {
        yield* sequence(0.04, ...this.ids.map(id => this.pathvis.fadeOutPath(id, 0.5)))
        yield* chain(...this.lines.map(v => v.end(0.3)))
    }
}

export default makeScene2D(function* (view) {
    const prng = new Random(11)

    const cboxView = <Layout />
    view.add(cboxView)
    const cbox = new CBox(cboxView)
    cbox.draw()

    const pathvis = new PathVisualizer(view)
    const cameraNode = pathvis.showCamera(cbox.camera, 35)
    const lightNode = pathvis.showLight(cbox.light)

    yield* waitUntil('light')
    yield* lightNode.scale(2, 1).to(1, 1)
    yield* waitUntil('camera')
    yield* cameraNode.scale(2, 1).to(1, 1)

    const useNEE = true
    const showAllPaths = !useNEE
    const numPaths = 50
    
    const cameraPaths: number[] = []
    const lightPaths: number[] = []

    for (let i = 0; i < numPaths; i++) {
        let rndDim = 0
        const paths = cbox.pathtrace(() => {
            if (rndDim++ == 0) {
                return i / (numPaths - 1)
            }
            return prng.nextFloat()
        }, useNEE)
        for (const path of paths) {
            if (!showAllPaths && path[path.length - 1].type !== PathVertexType.Light) {
                continue
            }
            cameraPaths.push(pathvis.showPath([ path[0], path[1] ]))
            lightPaths.push(pathvis.showPath([ path[1], path[2] ]))
            //const id = pathvis.showPath(path)
            //pathvis.getPath(id).opacity(0.5)
        }
    }

    yield* waitUntil('start')
    yield* sequence(0.05, ...cameraPaths.map(id =>
        pathvis.fadeInPath(id, 0.5)))
    yield* waitUntil('end')
    yield* sequence(0.05, ...lightPaths.map(id =>
        pathvis.fadeInPath(id, 0.5))
    )

    yield* waitUntil('known')
    const knownBeforehand = knownBeforehandLabel(cbox, view)
    yield* knownBeforehand.opacity(1, 1).wait(1).to(0, 1)
    
    yield* sequence(0.05, ...cameraPaths.map((id, index) =>
        chain(
            pathvis.fadeOutPath(cameraPaths[index], 0.5),
            pathvis.fadeOutPath(lightPaths[index], 0.5)
        )))
    ;
    
    yield* all(
        cameraNode.scale(0, 1),
        lightNode.scale(0, 1)
    );

    //
    // indirect focal points
    //

    yield cboxView.opacity(0)

    // laser

    const laserView = <Layout />
    view.add(laserView)
    const laser = new Laser(laserView)
    yield* waitUntil('laser')
    yield* laser.draw()
    yield* waitUntil('diffusing')
    yield* laser.drawReflection()

    yield* laserView.position([ -700, 0 ], 1)

    // obstruction

    const obstructionView = <Layout />
    view.add(obstructionView)
    const obstruction = new Obstruction(obstructionView)
    yield* obstruction.draw()
    yield* waitUntil('obs/done')

    yield* laser.hide()
    yield* obstruction.hide()

    yield* waitFor(100)
});
