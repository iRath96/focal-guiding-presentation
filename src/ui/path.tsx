import { Line, View2D, Node } from '@motion-canvas/2d'
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
    segments: Node[]
}

export class PathVisualizer {
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
                opacity={0.5}
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

    removePath(id: number) {
        if (!this.shownPaths.has(id)) return
        for (const segment of this.shownPaths.get(id).segments) {
            segment.remove()
        }
        this.shownPaths.delete(id)
    }
}
