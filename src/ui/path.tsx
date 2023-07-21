import { Line, View2D, Node, Layout, Img, Rect, Circle, LineProps } from '@motion-canvas/2d'
import { Circle2f, Vector2f, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_lerp, vec2f_multiply, vec2f_polar } from '../rt/math'
import { SimpleSignal, all, createSignal } from '@motion-canvas/core'

export enum PathVertexType {
    Camera,
    Diffuse,
    Specular,
    Light,
    Miss,
}

export interface PathVertex {
    p: Vector2f
    n: Vector2f
    type: PathVertexType
    nee?: boolean
}

interface PVPath {
    t0: SimpleSignal<number>
    t1: SimpleSignal<number>

    length: number
    root: Node
    segments: Node[]
}

export function path_length(path: PathVertex[]) {
    let length = 0
    for (let i = 1; i < path.length; i++) {
        length += vec2f_distance(path[i-1].p, path[i].p)
    }
    return length
}

export class PathVisualizer {
    private shownPaths = new Map<number, PVPath>()
    private nextId = 0

    showCamera(camera: Circle2f, rotation = 42) {
        const rvec = vec2f_polar(rotation / 180 * Math.PI)
        const size = 4 * camera.radius
        const pos = vec2f_add(
            vec2f_add(
                camera.center,
                vec2f_multiply(
                    vec2f(-rvec.y, rvec.x),
                    -0.05 * size
                )
            ),
            vec2f_multiply(rvec, -0.25 * size)
        )

        const layout = <Layout
            position={pos}
            zIndex={10}
        />
        layout.add(<Rect
            size={[ size, 0.7 * size ]}
            rotation={rotation}
            fill="000"
        />)
        layout.add(<Img
            size={size}
            rotation={rotation}
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
            fill="#000"
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

    showPath(path: PathVertex[], props: LineProps = {}, length = 0) {
        const root = <Layout />
        this.view.add(root)

        const t0 = createSignal(0)
        const t1 = createSignal(0)

        const pvp: PVPath = {
            t0: t0, t1: t1, length, root, segments: [] }
        for (let i = 1; i < path.length; i++) {
            const l = length
            const a = path[i-1].p
            const b = path[i].p
            const s = vec2f_distance(a, b)
            const lerp = (t: number) => vec2f_lerp(
                a,
                b,
                Math.min(Math.max(0, t - l) / s, 1)
            )
            const segment = <Line
                points={() => [ lerp(t0()), lerp(t1()) ]}
                stroke="#fff"
                lineWidth={4}
                arrowSize={12}
                endArrow={
                    path[i].type === PathVertexType.Diffuse ||
                    path[i].type === PathVertexType.Miss
                }
                zIndex={2}
                lineDash={path[i].nee ? [5,5] : undefined}
                {...props}
            />
            pvp.segments.push(segment)
            root.add(segment)
            length += s
        }

        pvp.length = length
        
        const id = this.nextId++
        this.shownPaths.set(id, pvp)
        return id
    }

    all() {
        return this.shownPaths.keys()
    }

    *fadeInPath(id: number, time: number, constSpeed = false) {
        const path = this.shownPaths.get(id)
        if (constSpeed) time *= path.length
        yield* path.t1(0, 0).to(path.length, time, t => t)
    }

    *fadeOutPath(id: number, time: number, constSpeed = false) {
        const path = this.shownPaths.get(id)
        if (constSpeed) time *= path.length
        yield* path.t0(0, 0).to(path.length, time, t => t)
    }

    getPath(id: number) {
        return this.shownPaths.get(id).root
    }

    getSegments(id: number) {
        return this.shownPaths.get(id).segments
    }

    removePath(id: number) {
        if (!this.shownPaths.has(id)) return
        this.shownPaths.get(id).root.remove()
        this.shownPaths.delete(id)
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
