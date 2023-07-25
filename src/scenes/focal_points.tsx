import {Circle, Line, Ray, View2D, makeScene2D, Node, Txt, Spline, Layout, Rect, Img, LineProps, Gradient} from '@motion-canvas/2d';
import {Random, SimpleSignal, all, chain, createRef, createSignal, debug, delay, sequence, waitFor, waitUntil} from '@motion-canvas/core';
import { Circle2f, Curve2f, Line2f, Ray2f, Vector2f, circle2f_evaluate, circle2f_intersect, circle2f_normal, curve2f_intersect, curve2f_normal, curve2f_rasterize, line2f_angle, line2f_evaluate, line2f_intersect, line2f_length, line2f_normal, ray2f_evaluate, sample_hemicircle, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_length, vec2f_lerp, vec2f_minus, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect, vec2f_refract, vec2f_sub, vec3f } from '../rt/math';
import { PathVertex, PathVertexType, PathVisualizer } from '../ui/path';
import { CBox } from '../common/cbox';
import { wiggle } from '../common/animations';
import { Captions } from '../common/captions';

function knownBeforehandLabel(cbox: CBox, view: Node) {
    const layout = <Layout
        position={vec2f_add(cbox.camera.center, vec2f(-40, -70))}
        zIndex={30}
    >
        <Spline
            points={[
                [95,-25],
                [50,20],
            ]}
            stroke={"#fff"}
            lineWidth={4}
            endArrow
            arrowSize={16}
        />
        <Spline
            points={[
                [455,-75],
                [500,-120],
            ]}
            stroke={"#fff"}
            lineWidth={4}
            endArrow
            arrowSize={16}
        />
        <Txt
            position={[276, -44]}
            scaleX={-1}
            text={"Known beforehand"}
            fill={"#fff"}
            fontSize={35}
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
    private markerOpacity = createSignal(0)

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
        yield this.laser()

        this.view.add(this.node)
        this.laser().scale(0)

        yield* this.laser().scale(1, 0.5)
        yield* wiggle(this.node, 1)
        yield* this.t1(1, 0.5)
    }

    *drawReflection() {
        const numPaths = 12
        for (let i = 0; i < numPaths; i++) {
            const t = (i + 0.5) / numPaths
            const off = vec2f_polar(Math.PI * (1.5 - t), 150)
            const point = vec2f_add(this.target, off)
            const path: PathVertex[] = [
                { type: PathVertexType.Diffuse, p: this.target, n: vec2f(0, 0) },
                { type: PathVertexType.Miss, p: point, n: vec2f(0, 0) },
            ]
            this.ids.push(this.pathvis.showPath(path))
        }

        this.view.add(<Layout
            scaleX={-1}
            position={() => vec2f_add(this.target, vec2f(
                0, 20 * (1 - this.markerOpacity())
            ))}
            opacity={this.markerOpacity}
        >
            <Line
                points={[
                    [-155,25],
                    [-155,0],
                    [-10,0]
                ]}
                stroke={"#fff"}
                lineWidth={4}
                arrowSize={10}
                endArrow
            />
            <Txt
                text={"Diffusing\nfocal point"}
                textAlign={"center"}
                x={-155}
                y={80}
                width={400}
                fill={"#fff"}
                fontSize={35}
            />
        </Layout>)

        yield* all(
            this.pathvis.fadeInPaths(this.ids, 0.3, 0.04),
            this.markerOpacity(1, 1),
        )
    }

    *hide() {
        yield* all(
            this.laser().scale(0, 0.5),
            this.t0(1, 0.5),
            this.pathvis.fadeOutPaths(this.ids, 0.3, 0.04),
            this.markerOpacity(0, 1),
        )
    }
}

class Obstruction {
    private pathvis: PathVisualizer
    private line: Line2f = {
        from: vec2f(300, -25),
        to: vec2f(300, 25),
    }
    private angle = createSignal(0)
    private tree = createRef<Img>()
    private markerOpacity = createSignal(0)

    private addGradient() {
        this.view.add(<Rect
            size={[1920, 500]}
            y={-400}
            fill={new Gradient({
                from: [0, -80],
                to: [0, 100],
                stops: [
                    { color: "black", offset: 0, },
                    { color: "rgba(0,0,0,0)", offset: 1, },
                ],
            })}
            zIndex={1}
        />)
    }

    constructor(
        private view: Node,
    ) {
        this.addGradient()

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
        yield this.tree()

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

        yield* this.pathvis.fadeInPaths(sunIds, 0.6)
        yield* this.pathvis.fadeInPaths(missIds, 0.6)
    }

    private *drawSuccessfulPaths() {
        const previousPaths = this.pathvis.all()

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

        this.view.add(<Layout
            scaleX={-1}
            position={() => vec2f_add(line2f_evaluate(this.line, 0.5), vec2f(
                0, -20 * (1 - this.markerOpacity())
            ))}
            opacity={this.markerOpacity}
        >
            <Line
                points={[
                    [150,-150],
                    [15,-15],
                ]}
                stroke={"#fff"}
                lineWidth={4}
                arrowSize={10}
                endArrow
            />
            <Txt
                text={"Occlusion focal point"}
                textAlign={"left"}
                position={[ 280, -180 ]}
                width={400}
                fill={"#fff"}
                fontSize={35}
            />
        </Layout>)

        yield* all(
            ...previousPaths.map(id =>
                this.pathvis.getPath(id).opacity(0.3, 1)
            ),
            this.pathvis.fadeInPaths(ids, 1),
            delay(0.5, this.markerOpacity(1, 1)),
        )
    }

    *draw() {
        yield* this.tree().opacity(1, 1)
        yield* this.drawFailedPaths()
        yield* this.angle(Math.PI, 1)
        yield* this.drawSuccessfulPaths()
    }

    *hide() {
        yield* all(
            ...this.pathvis.all().map(id =>
                this.pathvis.getPath(id).opacity(0, 1)
            ),
            this.tree().opacity(0, 1),
            this.markerOpacity(0, 1),
        )
        yield* this.angle(0, 2)
    }
}

function lerpPath(path: Vector2f[], t: number) {
    const base = path[0]
    return path.map(p => vec2f_lerp(base, p, t))
}

function apparentPosition(props: {
    y: SimpleSignal<number>
    opacity: SimpleSignal<number>
}) {
    return <Layout
        scaleX={-1}
        x={-140}
        y={props.y}
        opacity={props.opacity}
    >
        <Line
            points={[[-10,0], [-100,0]]}
            stroke={"#fff"}
            lineWidth={4}
            arrowSize={10}
            endArrow
        />
        <Txt
            text={"Apparent position"}
            x={215}
            y={3}
            width={400}
            fill={"#fff"}
            fontSize={35}
        />
    </Layout>
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
        let focalY: SimpleSignal<number>
        for (let i = 0; i < numPaths; i++) {
            const t = i / (numPaths - 1);
            const d = vec2f_polar(Math.PI * (0.5 - 0.30 * (t - 0.5)))
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

            if (i === 0) {
                focalY = createSignal(() => {
                    const a = path()[path().length-2]
                    const b = path()[path().length-1]
                    const d = vec2f_direction(a, b)
                    if (d.x < 0) return 1000
                    const t = -a.x / d.x
                    return a.y + t * d.y
                })
            }
        }

        this.view.add(apparentPosition({
            y: focalY,
            opacity: createSignal(() => Math.max(0, Math.min(1,
                1 - (focalY() - 85) / 200
            )))
        }))

        yield* waitUntil('vi/lens')
        yield* this.lensRayT(1, 1)
        yield* this.lensT(1, 1)
        yield* this.curvature(0.4, 1.5)
    }
}

class VirtualImageMirror {
    private pathvis: PathVisualizer

    private addGradient() {
        this.view.add(<Rect
            size={[1920, 500]}
            y={-400}
            fill={new Gradient({
                from: [0, -200],
                to: [0, 100],
                stops: [
                    { color: "black", offset: 0, },
                    { color: "rgba(0,0,0,0)", offset: 0.5, },
                ],
            })}
            zIndex={1}
        />)
    }

    constructor(
        private cbox: CBox,
        private view: Node
    ) {
        this.pathvis = new PathVisualizer(view)
        this.addGradient()
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
                if (vec2f_distance(t2.p, ray.o) > 350) {
                    t2.p = ray2f_evaluate(ray, 350)
                }
                points.push(t2)

                return points
            })()

            ids.push(this.pathvis.showPath(path))

            // reflection path

            const mirrorD = vec2f_direction(
                path[1].p,
                cbox.mirroredLight.center
            )
            const path2 = [
                path[1],
                {
                    ...path[0],
                    //p: cbox.mirrorAtCeiling(path[0].p),
                    //p: cbox.mirroredLight.center,
                    //p: vec2f_lerp(path[2].p, path[1].p, 2)
                    p: vec2f_add(path[1].p,
                        vec2f_multiply(mirrorD, -400 / mirrorD.y))
                },
            ]
            ids.push(this.pathvis.showPath(path2, {
                lineDash: [8,8],
                lineWidth: 2
            }))
        }

        yield* waitUntil('vi/mirror')
        const opacity = createSignal(0)
        this.view.add(apparentPosition({
            y: createSignal(cbox.mirroredLight.center.y),
            opacity
        }))
        yield* all(
            this.pathvis.fadeInPaths(ids, 1),
            opacity(1, 1),
        )
    }
}

export default makeScene2D(function* (originalView) {
    const captions = createRef<Captions>()
    originalView.add(<Captions
        ref={captions}
        chapter="Focal points"
    />);

    const view = <Layout
        position={[-350, 55]}
        scale={[ -1, 1 ]}
    />
    originalView.add(view)
    
    const prng = new Random(11)

    const cboxView = <Layout />
    view.add(cboxView)
    const cbox = new CBox(cboxView)
    cbox.cameraDir = 34.4
    cbox.cameraSpread = 25
    cbox.draw()

    const pathvis = new PathVisualizer(view)
    
    yield* captions().updateTitle("Direct focal points");

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
    yield* pathvis.fadeInPaths(cameraPaths, 1, 0.05)

    yield* waitUntil('end')
    yield* pathvis.fadeInPaths(lightPaths, 0.5, 0.05)

    yield* waitUntil('known')
    const knownBeforehand = knownBeforehandLabel(cbox, view)
    yield* knownBeforehand.opacity(1, 1)
    yield* waitFor(1)
    
    const pathRemove = sequence(0.05, ...cameraPaths.map((id, index) =>
        chain(
            pathvis.fadeOutPath(cameraPaths[index], 0.5),
            pathvis.fadeOutPath(lightPaths[index], 0.5)
        )))
    ;
    
    yield* all(
        cbox.cameraNode.scale(0, 1),
        cbox.lightNode.scale(0, 1),
        captions().reset(),
        knownBeforehand.opacity(0, 1),
        pathRemove,
    );

    //
    // indirect focal points
    //

    yield* captions().updateTitle("Indirect focal points");

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

    const viewOriginalX = view.x()
    const obstructionView = <Layout />
    view.add(obstructionView)
    const obstruction = new Obstruction(obstructionView)
    yield* all(
        obstruction.draw(),
        view.x(viewOriginalX + 250, 2),
    )
    yield* waitUntil('obs/done')
    yield* all(
        obstruction.hide(),
        delay(1, captions().reset()),
        view.x(viewOriginalX, 2),
    )

    //
    // virtual images
    //

    yield* all(
        cbox.lightNode.scale(1, 1),
        captions().updateTitle("Virtual images"),
    );

    const viLensView = <Layout />;
    view.add(viLensView)
    const viLens = new VirtualImageLens(cbox, viLensView)
    yield* viLens.draw()
    yield* viLensView.opacity(0.5, 1)

    const viMirrorView = <Layout />;
    view.add(viMirrorView)
    const viMirror = new VirtualImageMirror(cbox, viMirrorView)
    yield* viMirror.draw()

    yield* waitUntil('vi/done')
    yield* all(
        viLensView.opacity(0, 2),
        viMirrorView.opacity(0, 2),
        delay(1, captions().reset())
    )
});
