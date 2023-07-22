import {Circle, Line, Ray, View2D, makeScene2D, Node, Txt, Spline, Layout, Rect, Img, LineProps} from '@motion-canvas/2d';
import {Random, SimpleSignal, all, chain, createRef, createSignal, debug, delay, sequence, waitFor, waitUntil} from '@motion-canvas/core';
import { Circle2f, Curve2f, Line2f, Ray2f, Vector2f, circle2f_evaluate, circle2f_intersect, circle2f_normal, curve2f_intersect, curve2f_normal, curve2f_rasterize, line2f_angle, line2f_evaluate, line2f_intersect, line2f_length, line2f_normal, ray2f_evaluate, sample_hemicircle, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_length, vec2f_lerp, vec2f_minus, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect, vec2f_refract, vec2f_sub, vec3f } from '../rt/math';
import { PathVertex, PathVertexType, PathVisualizer } from '../ui/path';
import { CBox } from '../common/cbox';
import { wiggle } from '../common/animations';

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
    public position = vec2f(-300, 100)
    public target = vec2f(300, -70)
    public pathvis: PathVisualizer
    public node: Node
    private laser = createRef<Img>()

    private ids: number[] = []
    private t0 = createSignal(0)
    private t1 = createSignal(0)

    constructor(
        private view: Node
    ) {
        this.pathvis = new PathVisualizer(view)
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
        yield* wiggle(this.node, 1)
        yield* this.t1(1, 0.5)
    }

    *drawReflection() {
        const numPaths = 14
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1)
            const off = vec2f_polar(Math.PI * (1.5 - t), 150)
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
    private line: Line2f = {
        from: vec2f(300, -25),
        to: vec2f(300, 25),
    }
    private angle = createSignal(0)
    private tree = createRef<Img>()

    constructor(
        private view: Node,
    ) {
        const angle0 = line2f_angle(this.line)
        const dist = line2f_length(this.line)
        const shift = createSignal(() => vec2f(2 * this.angle(), 0))
        const from = createSignal(() => vec2f_add(this.line.from, shift()))
        const to = createSignal(() => vec2f_add(this.line.to, shift()))

        this.pathvis = new PathVisualizer(view)
        view.add(<Rect
            size={[ 10, Math.abs(this.line.from.y - this.line.to.y)]}
            position={line2f_evaluate(this.line, 0.5)}
            fill={"#000"}
        />)
        view.add(<Line
            points={() => [
                from(),
                vec2f_add(from(),
                    vec2f_polar(angle0 - this.angle(), dist / 2))
            ]}
            stroke={"#fff"}
            lineWidth={() => 4 + this.angle()}
            zIndex={20}
        />)
        view.add(<Line
            points={() => [
                to(),
                vec2f_add(to(),
                    vec2f_polar(-angle0 + this.angle(), dist / 2))
            ]}
            stroke={"#fff"}
            lineWidth={() => 4 + this.angle()}
            zIndex={20}
        />)
        view.add(<Img
            ref={this.tree}
            opacity={0}
            size={500}
            position={[ 600, 82 ]}
            src={"svg/tree-2-svgrepo-com.svg"}
            zIndex={20}
        />)
    }

    private *drawFailedPaths() {
        const failPRNG = new Random(1234)
        const failedPaths = 30
        const treeLine: Line2f = {
            from: vec2f(570, -120),
            to: vec2f(450, 100),
        }
        const wallLine: Line2f = {
            from: vec2f(300, -300),
            to: vec2f(300, 300),
        }
        const sunIds: number[] = []
        const missIds: number[] = []
        for (let i = 0; i < failedPaths; i++) {
            const a = line2f_evaluate(treeLine, i / (failedPaths - 1))
            const b = line2f_evaluate(wallLine, failPRNG.nextFloat())
            missIds.push(this.pathvis.showPath([
                {
                    p: a,
                    n: vec2f(0, 0), type: PathVertexType.Diffuse },
                {
                    p: b,
                    n: vec2f(0, 0), type: PathVertexType.Diffuse },
            ], {
                stroke: "#027580",
                opacity: 0.7
            }));
            (i % 2 == 0) && sunIds.push(this.pathvis.showPath([
                {
                    p: vec2f_add(a, vec2f(-250, -700)),
                    n: vec2f(0, 0), type: PathVertexType.Light },
                {
                    p: a,
                    n: vec2f(0, 0), type: PathVertexType.Specular },
            ], {
                stroke: "#FEA925",
                opacity: 0.6
            }));
        }

        yield* all(...sunIds.map(id =>
            this.pathvis.fadeInPath(id, 0.6)
        ))
        yield* all(...missIds.map(id =>
            this.pathvis.fadeInPath(id, 0.6)
        ))
    }

    private *drawSuccessfulPaths() {
        yield* all(...[ ...this.pathvis.all() ].map(id =>
            this.pathvis.getPath(id).opacity(0.3, 1)
        ))
        const ids: number[] = []
        const focalPoint = line2f_evaluate(this.line, 0.5)
        const numPaths = 15
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1)
            const d = vec2f_polar(0.14 * Math.PI * (2 * t - 1) + Math.PI)
            const t0 = -290 + t * 200 + t*t * 20 - t*t*t * 100
            ids.push(this.pathvis.showPath([
                {
                    p: vec2f_add(focalPoint, vec2f_multiply(d, t0)),
                    n: vec2f(0, 0), type: PathVertexType.Diffuse },
                {
                    p: vec2f_add(focalPoint, vec2f_multiply(d, 300)),
                    n: vec2f(0, 0), type: PathVertexType.Diffuse },
            ], {
                stroke: "#027580"
            }))
        }

        yield* all(...ids.map(id =>
            this.pathvis.fadeInPath(id, 1)
        ))
    }

    *draw() {
        yield* this.tree().opacity(1, 1)
        yield* this.drawFailedPaths()
        yield* this.angle(Math.PI, 1)
        yield* this.drawSuccessfulPaths()
    }

    *hide() {
        yield* all(
            ...[ ...this.pathvis.all() ].map(id =>
                this.pathvis.getPath(id).opacity(0, 1)
            ),
            this.tree().opacity(0, 1)
        )
        yield* this.angle(0, 2)
    }
}

function lerpPath(path: Vector2f[], t: number) {
    const base = path[0]
    return path.map(p => vec2f_lerp(base, p, t))
}

class VirtualImageLens {
    private lensRayT = createSignal(0)
    private lensT = createSignal(0)
    private curvature = createSignal(0)

    constructor(
        private cbox: CBox,
        private view: Node
    ) {
    }

    *draw() {
        const width = 100
        const y = -110
        const lensA: Line2f = {
            from: vec2f(width, y),
            to: vec2f(-width, y),
        }
        const lensB = createSignal<Curve2f>(() => ({
            t: {
                x: vec3f(width,0,0),
                y: vec3f(0,width,y),
                z: vec3f(0,0,1),
            },
            c0: 1.2 * this.curvature(),
            c2: -this.curvature(),
            c4: 0.14 * this.curvature(),
        }))
        this.view.add(<Line
            points={() => [
                ...curve2f_rasterize(lensB(), 64),
                lensA.from, lensA.to
            ]}
            scale={() => [ this.lensT(), 1 ]}
            closed
            fill="rgba(59, 91, 255, 0.5)"
            stroke="rgb(59, 91, 255)"
            lineWidth={4}
            zIndex={2}
        />)

        const cbox = this.cbox
        const light = this.cbox.light
        const ior = 3
        const numPaths = 10
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1);
            const d = vec2f_polar(Math.PI * (0.5 - 0.4 * (t - 0.5)))
            const o = vec2f_add(
                light.center,
                vec2f_multiply(d, light.radius)
            )
            const path = createSignal<Vector2f[]>(() => {
                let ray: Ray2f = { o, d }
                const points = [ ray.o ]
                function miss(t: number) {
                    if (!isFinite(t)) return true
                    ray.o = ray2f_evaluate(ray, t)
                    points.push(ray.o)
                    return false
                }
                function exit() {
                    const t = cbox.intersect(ray)
                    points.push(t.p)
                    return points
                }

                if (miss(line2f_intersect(lensA, ray))) return exit()
                ray.d = vec2f_refract(vec2f(0, -1), ray.d, 1/ior)

                const cisect = curve2f_intersect(lensB(), ray)
                if (miss(cisect.t)) return exit()
                const cnormal = vec2f_multiply(curve2f_normal(lensB(), cisect.x), -1)
                ray.d = vec2f_refract(cnormal, ray.d, ior)

                return exit()
            })

            this.view.add(<Line
                points={() => lerpPath(path(), this.lensRayT())}
                stroke={"#fff"}
                lineWidth={4}
                arrowSize={12}
                endArrow
            />)
        }

        yield* waitUntil('vi/lens')
        yield* this.lensRayT(1, 1)
        yield* this.lensT(1, 1)
        yield* this.curvature(0.4, 1.5)
    }
}

class VirtualImageMirror {
    private pathvis: PathVisualizer

    constructor(
        private cbox: CBox,
        private view: Node
    ) {
        this.pathvis = new PathVisualizer(view)
    }

    *draw() {
        const ids: number[] = []
        const cbox = this.cbox
        const light = this.cbox.light
        const numPaths = 10
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1);
            const d = vec2f_polar(Math.PI * (-0.5 - 0.7 * (t - 0.5)))
            const o = vec2f_add(
                light.center,
                vec2f_multiply(d, light.radius)
            )
            const path = (() => {
                let ray: Ray2f = { o, d }
                const points: PathVertex[] = [{
                    p: ray.o,
                    n: vec2f(0, 0),
                    type: PathVertexType.Camera,
                }]

                const t1 = cbox.intersect(ray)
                points.push(t1)
                if (t1.type !== PathVertexType.Specular) return points

                ray.o = t1.p
                ray.d = vec2f_reflect(t1.n, vec2f_multiply(ray.d, -1))
                const t2 = cbox.intersect(ray)
                points.push(t2)

                return points
            })()

            ids.push(this.pathvis.showPath(path))
        }

        yield* waitUntil('vi/mirror')
        yield* all(...ids.map(id =>
            this.pathvis.fadeInPath(id, 1)
        ))
    }
}

export default makeScene2D(function* (view) {
    const prng = new Random(11)

    const cboxView = <Layout />
    view.add(cboxView)
    const cbox = new CBox(cboxView)
    cbox.cameraDir = 34.4
    cbox.cameraSpread = 25
    cbox.draw()

    const pathvis = new PathVisualizer(view)
    
    yield* waitUntil('light')
    yield* wiggle(cbox.lightNode, 1.5)
    yield* waitUntil('camera')
    yield* wiggle(cbox.cameraNode, 1.5)

    const useNEE = true
    const showAllPaths = !useNEE
    const numPaths = 10
    
    const cameraPaths: number[] = []
    const lightPaths: number[] = []

    for (let i = 0; i < numPaths; i++) {
        let rndDim = 0
        const paths = cbox.pathtrace(() => {
            if (rndDim++ == 0) {
                return i / (numPaths - 1)
            }
            return prng.nextFloat()
        }, { useNEE, maxDepth: 2 })
        for (const path of paths) {
            if (path.length <= 2) continue;
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
        cbox.cameraNode.scale(0, 1),
        cbox.lightNode.scale(0, 1)
    );

    //
    // indirect focal points
    //

    // laser

    const laserView = <Layout />
    view.add(laserView)
    const laser = new Laser(laserView)
    yield* waitUntil('laser')
    yield* laser.draw()
    yield* waitUntil('diffusing')
    yield* laser.drawReflection()
    yield* waitUntil('laser/end')
    yield* laser.hide()

    // obstruction

    const obstructionView = <Layout />
    view.add(obstructionView)
    const obstruction = new Obstruction(obstructionView)
    yield* obstruction.draw()
    yield* waitUntil('obs/done')
    yield* obstruction.hide()

    //
    // virtual images
    //

    yield* all(
        cbox.lightNode.scale(1, 1)
    );

    const viLensView = <Layout />;
    view.add(viLensView)
    const viLens = new VirtualImageLens(cbox, viLensView)
    yield* viLens.draw()
    yield* viLensView.opacity(0.5, 2)

    const viMirrorView = <Layout />;
    view.add(viMirrorView)
    const viMirror = new VirtualImageMirror(cbox, viMirrorView)
    yield* viMirror.draw()

    yield* all(
        viLensView.opacity(0, 2),
        viMirrorView.opacity(0, 2)
    )
});
