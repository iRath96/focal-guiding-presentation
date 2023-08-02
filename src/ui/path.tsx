import { Line, View2D, Node, Layout, Img, Rect, Circle, LineProps } from '@motion-canvas/2d'
import { Circle2f, Vector2f, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_lerp, vec2f_multiply, vec2f_polar } from '../rt/math'
import { Random, SignalValue, SimpleSignal, all, createRef, createSignal, sequence } from '@motion-canvas/core'
import { colors } from '../common';

/**
 * Shuffles array in place.
 * @param a items An array containing the items.
 * @note Taken from https://stackoverflow.com/a/6274381
 */
export function shuffle<T>(a: T[], random = new Random(42)): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = random.nextInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export enum PathVertexType {
    Camera,
    Diffuse,
    Specular,
    Light,
    Miss,
}

export interface PathVertex {
    p: Vector2f
    type?: PathVertexType
    n?: Vector2f
    nee?: boolean
}

export type Path = PathVertex[]

interface PVSegment {
    a: SimpleSignal<Vector2f>
    b: SimpleSignal<Vector2f>
    node: Node
}

interface PVPath {
    t0: SimpleSignal<number>
    t1: SimpleSignal<number>

    length: number
    root: Node
    props: LineProps
    segments: PVSegment[]
}

export function* path_segments(path: Path):
    Generator<[PathVertex, PathVertex]> {
    for (let i = 1; i < path.length; i++) {
        yield [ path[i-1], path[i] ]
    }
}

export function path_length(path: Path): number {
    return [ ...path_segments(path) ].reduce((len, [a,b]) =>
        vec2f_distance(a.p, b.p)
    , 0)
}

interface ShowPathProps extends LineProps {
    length?: number
    visible?: boolean
}

export class PathVisualizer {
    private shownPaths = new Map<number, PVPath>()
    private nextId = 0

    showCamera(camera: Circle2f, rotation = 42) {
        const size = 4 * camera.radius
        const lpos = vec2f(-0.25 * size, -0.05 * size)

        const layout = <Layout
            position={camera.center}
            rotation={rotation}
            zIndex={10}
        />
        layout.add(<Rect
            position={lpos}
            size={[ size, 0.7 * size ]}
            fill="000"
        />)
        layout.add(<Img
            position={lpos}
            size={size}
            src={"svg/camera-side-view-svgrepo-com.svg"}
        />)
        this.view.add(layout)
        return layout
    }

    showLight(light: Circle2f) {
        const layout = <Layout
            position={light.center}
            zIndex={10}
        />
        layout.add(<Circle
            size={2 * light.radius}
            fill={colors.black}
        />)
        layout.add(<Img
            size={3 * light.radius}
            position={vec2f(0, -0.5 * light.radius)}
            rotation={180}
            src={"svg/lighbulb-with-filament-svgrepo-com.svg"}
        />)
        this.view.add(layout)
        return layout
    }
    
    constructor(
        private view: Node
    ) {}

    private createSegment(pvp: PVPath, v0: PathVertex, v1: PathVertex) {
        const l = pvp.length
        const a = createSignal(v0.p)
        const b = createSignal(v1.p)
        const s = createSignal(() => vec2f_distance(a(), b()));
        const lerp = (t: number) => vec2f_lerp(
            a(), b(),
            Math.min(Math.max(0, t - l) / s(), 1)
        )
        const node = <Line
            points={() => [ lerp(pvp.t0()), lerp(pvp.t1()) ]}
            stroke={colors.yellow}
            lineWidth={4}
            arrowSize={12}
            endArrow={
                v1.type === PathVertexType.Diffuse ||
                //v1.type === PathVertexType.Light ||
                v1.type === PathVertexType.Miss
            }
            zIndex={2}
            lineDash={v1.nee ? [5,5] : undefined}
            {...pvp.props}
        />
        const segment: PVSegment = {
            a, b,
            node
        }
        pvp.segments.push(segment)
        pvp.root.add(segment.node)
        pvp.length += s()

        return segment
    }

    showPath(path: Path, props: ShowPathProps = {}) {
        let { length, visible, ...lineProps } = {
            length: 0,
            visible: false,
            ...props
        }

        const pvp: PVPath = {
            t0: createSignal(0),
            t1: createSignal(0),
            length,
            root: <Layout />,
            props: lineProps,
            segments: []
        }
        for (const [ v0, v1 ] of path_segments(path)) {
            this.createSegment(pvp, v0, v1)
        }

        if (visible) pvp.t1(pvp.length)
        
        this.view.add(pvp.root)
        const id = this.nextId++
        this.shownPaths.set(id, pvp)
        return id
    }

    *opacity(opacity: number, time: number) {
        yield* all(...[...this.shownPaths.values()].map(p =>
            p.root.opacity(opacity, time)
        ))
    }

    all() {
        return [...this.shownPaths.keys()]
    }

    *fadeInPath(id: number, time: number, constSpeed = false) {
        const path = this.shownPaths.get(id)
        if (constSpeed) time *= path.length
        yield* path.t1(0, 0).to(path.length, time, t => t)
    }

    *fadeInPaths(ids: number[], time: number, delay = 0) {
        yield* sequence(delay, ...ids.map(id =>
            this.fadeInPath(id, time)
        ))
    }

    *fadeOutPath(id: number, time: number, constSpeed = false) {
        const path = this.shownPaths.get(id)
        if (constSpeed) time *= path.length
        yield* path.t0(0, 0).to(path.length, time, t => t)
    }

    *fadeOutPaths(ids: number[], time: number, delay = 0) {
        yield* sequence(delay, ...ids.map(id =>
            this.fadeOutPath(id, time)
        ))
    }

    getPath(id: number) {
        return this.shownPaths.get(id).root
    }

    *updatePath(id: number, path: Path, time = 1) {
        const pvp = this.shownPaths.get(id);
        if (!pvp) return
        const newSegments: PVSegment[] = []
        const tasks = [ ...path_segments(path) ].map(([ v0, v1 ], i) => {
            if (pvp.segments.length <= i) {
                const segment = this.createSegment(pvp, v0, v1)
                newSegments.push(segment)
                segment.node.opacity(0)
            }
            const segment = pvp.segments[i]
            return all(
                segment.a(v0.p, time),
                segment.b(v1.p, time),
            )
        });
        const unusedSegments = pvp.segments.slice(path.length - 1)
        pvp.t1(Infinity)
        yield* all(
            ...newSegments.map(s => s.node.opacity(pvp.props.opacity || 1, time)),
            ...unusedSegments.map(s => s.node.opacity(0, time)),
            ...tasks
        )
        for (const us of unusedSegments) us.node.remove()
        pvp.segments.splice(path.length - 1)
    }

    getSegments(id: number): Node[] {
        return this.shownPaths.get(id).segments.map(s => s.node)
    }

    removePath(id: number) {
        if (!this.shownPaths.has(id)) return
        this.shownPaths.get(id).root.remove()
        this.shownPaths.delete(id)
    }

    removePaths(ids: number[]) {
        for (const id of ids) {
            this.removePath(id)
        }
    }

    removeAll() {
        for (const path of this.shownPaths.values()) {
            path.root.remove()
        }
        this.shownPaths.clear()
    }

    *fadeAndRemove(time: number) {
        yield* all(...[ ...this.shownPaths.values() ].map(path =>
            path.root.opacity(0, time)
        ))
        this.removeAll()
    }
}
