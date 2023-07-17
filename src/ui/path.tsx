import { Line, View2D, Node, Layout } from '@motion-canvas/2d'
import { Vector2f } from '../rt/math'

export enum PathVertexType {
    Camera,
    Diffuse,
    Specular,
    Light,
    Miss,
}

export interface PathVertex {
    p: Vector2f
    type: PathVertexType
}

interface PVPath {
    root: Node
    segments: Node[]
}

export class PathVisualizer {
    private shownPaths = new Map<number, PVPath>()
    private nextId = 0
    
    constructor(
        private view: View2D
    ) {}

    showPath(path: PathVertex[]) {
        const root = <Layout />
        this.view.add(root)

        const pvp: PVPath = { root, segments: [] }
        for (let i = 1; i < path.length; i++) {
            const segment = <Line
                points={[ path[i-1].p, path[i].p ]}
                stroke="#ffffff"
                lineWidth={4}
                endArrow={
                    path[i].type == PathVertexType.Diffuse
                }
                zIndex={2}
            />
            pvp.segments.push(segment)
            root.add(segment)
        }

        const id = this.nextId++
        this.shownPaths.set(id, pvp)
        return id
    }

    getPath(id: number) {
        return this.shownPaths.get(id).root
    }

    removePath(id: number) {
        if (!this.shownPaths.has(id)) return
        this.shownPaths.get(id).root.remove()
        this.shownPaths.delete(id)
    }
}
