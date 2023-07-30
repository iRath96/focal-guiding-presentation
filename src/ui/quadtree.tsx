import { Rect, View2D, Node } from "@motion-canvas/2d"
import { QuadTree, QuadTreePatch } from "../rt/quadtree"
import { bounds2f_center, vec2f_sub } from "../rt/math"
import { ThreadGenerator, all, createEaseOutBack, createRef, delay } from "@motion-canvas/core"

export class QuadtreeVisualizer {
    private shownPatches = new Map<number, Rect>()
    private previousMaxId = 0
    public maxDensity = 1
    public gridOpacity = 1
    public gridLineWidth = 1

    constructor(
        public view: Node,
        private quadtree: QuadTree
    ) {}

    private get strokeStyle() {
        return `rgba(255, 255, 255, ${this.gridOpacity})`
    }

    private createRect(patch: QuadTreePatch) {
        const center = bounds2f_center(patch.bounds)
        const ref = createRef<Rect>()
        const node = <Rect
            ref={ref}
            position={center}
            size={vec2f_sub(patch.bounds.max, patch.bounds.min)}
            stroke={this.strokeStyle}
            lineWidth={this.gridLineWidth}
        />
        return ref()
    }

    *highlight(id: number, time = 0.5, scale = 1.2) {
        const rect = this.shownPatches.get(id)
        yield* all(
            rect.lineWidth(this.gridLineWidth * 2, time / 2),
            rect.scale(scale, time / 2),
            //rect.stroke("white", time / 2),
            rect.zIndex(1, time / 2),
        )
        yield* all(
            rect.lineWidth(this.gridLineWidth, time / 2),
            rect.scale(1.0, time / 2),
            //rect.stroke(this.strokeStyle, time / 2),
            rect.zIndex(0, time / 2),
        )
    }

    getRect(id: number) {
        return this.shownPatches.get(id)
    }

    *colorRect(id: number, density: number, time = 1) {
        yield* this.shownPatches.get(id).fill(
            `rgba(255, 127, 0, ${density.toFixed(2)})`, time)
    }

    *show() {
        const elementAnimationTime = 0.1

        const unusedPatches = new Set(this.shownPatches.keys())
        const newPatches = new Set<number>()
        let tasks: {
            time: number;
            task: ThreadGenerator;
        }[] = []

        let newMaxId = 0
        let minTime = Infinity
        let maxTime = -Infinity
        for (const patch of this.quadtree.visualize()) {
            const center = bounds2f_center(patch.bounds)
            const time = -(center.x + center.y)
            minTime = Math.min(minTime, time)
            maxTime = Math.max(maxTime, time)

            const { id } = patch.node
            const isExisting = this.shownPatches.has(id)
            if (isExisting) {
                unusedPatches.delete(id)
            } else {
                newPatches.add(id)

                const wasSplit = id > this.previousMaxId

                const rect = this.createRect(patch);
                this.shownPatches.set(id, rect)
                this.view.add(rect)

                rect.opacity(0)
                rect.scale(wasSplit ? 0.1 : 1)
                tasks.push({
                    time,
                    task: all(
                        rect.opacity(1, elementAnimationTime),
                        rect.scale(1, elementAnimationTime,
                            createEaseOutBack(2))
                    )
                })
            }
            newMaxId = Math.max(newMaxId, id)

            // update density
            const a = Math.min(patch.density / this.maxDensity, 1)
            const rect = this.shownPatches.get(id);
            tasks.push({
                time,
                task: rect.fill(`rgba(255, 127, 0, ${a.toFixed(2)})`, isExisting ?
                    0.5 : 0)
            })
        }

        for (const id of unusedPatches) {
            const rect = this.shownPatches.get(id);
            const center = rect.position()
            const time = -(center.x + center.y)
            minTime = Math.min(minTime, time)
            maxTime = Math.max(maxTime, time)

            rect.opacity(1)
            tasks.push({
                time,
                task: rect.opacity(0, elementAnimationTime)
            })
        }

        // animate in new nodes
        const remapTime = (t: number) => (t - minTime) / (maxTime - minTime);
        yield *all(...tasks.map(t => delay(remapTime(t.time), t.task)))

        // delete old nodes
        for (const id of unusedPatches) {
            this.shownPatches.get(id).remove()
            this.shownPatches.delete(id)
        }

        // bookkeeping
        this.previousMaxId = newMaxId
    }
}
