import {Line, Ray, Rect, makeScene2D} from '@motion-canvas/2d'
import { Bounds2f, Line2f, Ray2f, Vector2f, bounds2f_center, bounds2f_copy, line2f_intersect, vec2f, vec2f_add, vec2f_copy, vec2f_multiply, vec2f_normalized, vec2f_sub } from '../rt/math';
import { createSignal } from '@motion-canvas/core';

interface QuadTreeNode {
    id: number
    accumulator: number
    density: number
    children?: QuadTreeNode[]
}

interface QuadTreePatch {
    node: QuadTreeNode
    density: number
    bounds: Bounds2f
}

interface QuadTreeTraversal {
    patch: QuadTreePatch
    t0: number
    t1: number
}

class QuadTree {
    private lastId = 0
    private root: QuadTreeNode = {
        id: 0,
        accumulator: 0,
        density: 0,
    }

    constructor(
        public bounds: Bounds2f,
        public minDepth: number,
        public maxDepth: number,
        public splitThreshold: number,
    ) {
        this.rebuild()
    }

    private rebuildNode(node: QuadTreeNode, depth: number, rootWeight: number) {
        const wasSplit = node.children != undefined
        const canBeSplit = depth < this.maxDepth
        const wantsToBeSplit = depth < this.minDepth ||
            node.accumulator > this.splitThreshold * rootWeight
        const willBeSplit = canBeSplit && wantsToBeSplit

        if (wasSplit && !willBeSplit) {
            delete node.children
        }

        if (!wasSplit && willBeSplit) {
            node.children = []
            for (let i = 0; i < 4; i++) {
                node.children.push({
                    id: this.lastId++,
                    accumulator: node.accumulator / 4,
                    density: node.density / 4,
                })
            }
        }

        if (willBeSplit) {
            for (const child of node.children) {
                this.rebuildNode(child, depth + 1, rootWeight)
            }
        }
    }

    private propagateNode(node: QuadTreeNode): number {
        if (node.children) {
            node.accumulator = node.children.reduce((acc, child) =>
                acc + this.propagateNode(child), 0)
        }
        return node.accumulator
    }

    rebuild() {
        this.rebuildNode(this.root, 0,
            this.propagateNode(this.root))
    }

    private childBounds(bounds: Bounds2f, i: number) {
        const mid = bounds2f_center(bounds);
        const b = bounds2f_copy(bounds);
        (i & 1 ? b.min : b.max).x = mid.x;
        (i & 2 ? b.min : b.max).y = mid.y;
        return b
    }

    private collectPatches(node: QuadTreeNode, bounds: Bounds2f): QuadTreePatch[] {
        if (node.children == undefined) {
            return [{
                node,
                density: node.density,
                bounds
            }]
        }

        return node.children.reduce((patches, child, i) =>
            [ ...patches, ...this.collectPatches(child, this.childBounds(bounds, i)) ]
        , [])
    }

    public visualize() {
        return this.collectPatches(this.root, this.bounds)
    }

    private firstNode(tNear: Vector2f, tMid: Vector2f) {
        const maxDimension = tNear.x < tNear.y ? 1 : 0
        const maxValue = Math.max(tNear.x, tNear.y)
        
        let result = 0
        if (maxDimension == 1 && tMid.x < maxValue) result |= 1
        if (maxDimension == 0 && tMid.y < maxValue) result |= 2
        return result
    }

    private newNode(currNode: number, tFar: Vector2f) {
        const exitDimension = tFar.x < tFar.y ? 0 : 1
        const flag = 1 << exitDimension
        if (currNode & flag) return 4
        return currNode | flag
    }

    private* traverseNode(
        bounds: Bounds2f, node: QuadTreeNode, t: Bounds2f, a: number
    ): Generator<QuadTreeTraversal> {
        if (!node.children) {
            yield {
                t0: Math.max(t.min.x, t.min.y),
                t1: Math.min(t.max.x, t.max.y),
                patch: {
                    bounds,
                    node,
                    density: node.density
                },
            }
            return
        }

        const tMid = bounds2f_center(t)
        let currNode = this.firstNode(t.min, tMid)
        do {
            let tChild = bounds2f_copy(t);
            ((currNode >> 0) & 1 ? tChild.min : tChild.max).x = tMid.x;
            ((currNode >> 1) & 1 ? tChild.min : tChild.max).y = tMid.y;

            const childIndex = a ^ currNode
            const child = node.children[childIndex]
            yield *this.traverseNode(
                this.childBounds(bounds, childIndex),
                child, tChild, a)
            currNode = this.newNode(currNode, tChild.max)
        } while (currNode < 4)
    }

    public* traverse(ray: Ray2f) {
        ray = { o: vec2f_copy(ray.o), d: vec2f_copy(ray.d) }

        let a = 0
        if (ray.d.x == 0) ray.d.x = 1e-10 // TODO: hack
        if (ray.d.y == 0) ray.d.y = 1e-10 // TODO: hack

        if (ray.d.x < 0) {
            ray.o.x = this.bounds.max.x + this.bounds.min.x - ray.o.x
            ray.d.x = -ray.d.x
            a |= 1
        }

        if (ray.d.y < 0) {
            ray.o.y = this.bounds.max.y + this.bounds.min.y - ray.o.y
            ray.d.y = -ray.d.y
            a |= 2
        }

        const tNear = vec2f(
            (this.bounds.min.x - ray.o.x) / ray.d.x,
            (this.bounds.min.y - ray.o.y) / ray.d.y,
        )

        const tFar = vec2f(
            (this.bounds.max.x - ray.o.x) / ray.d.x,
            (this.bounds.max.y - ray.o.y) / ray.d.y,
        )

        if (Math.max(tNear.x, tNear.y) < Math.min(tFar.x, tFar.y)) {
            yield *this.traverseNode(
                this.bounds, this.root, { min: tNear, max: tFar }, a)
        }
    }
}

function easeOutBack(x: number): number {
    const c1 = 2
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export default makeScene2D(function* (view) {
    const quadtree = new QuadTree({
        min: vec2f(-400, -400),
        max: vec2f(400, 400),
    }, 4, 16, 0.02)

    const ray: Ray2f = {
        o: vec2f(-180, 80),
        d: vec2f_normalized(vec2f(0.8, -0.2)),
    }
    const line: Line2f = {
        from: vec2f(500, -400),
        to: vec2f(500, 400)
    }

    const endT = line2f_intersect(line, ray)
    for (const t of quadtree.traverse(ray)) {
        const contrib = (t.t1 - t.t0) / endT
        t.patch.node.accumulator += contrib
    }

    quadtree.minDepth = 0
    quadtree.rebuild()

    const hit = new Set<number>()
    for (const t of quadtree.traverse(ray)) {
        //console.log(t)
        if (t.t1 < 0) continue
        hit.add(t.patch.node.id)
    }

    const t = createSignal(0)

    let count = 0
    for (const patch of quadtree.visualize()) {
        count++
        const center = bounds2f_center(patch.bounds)
        const startT = (center.x - center.y + 900) / 2100
        const u = () => {
            const u = (t() - startT) * 10
            return Math.min(Math.max(u, 0), 1)
        }
        view.add(
            <Rect
                position={center}
                size={() => vec2f_multiply(vec2f_sub(patch.bounds.max, patch.bounds.min),
                    easeOutBack(u())
                )}
                opacity={() => (hit.has(patch.node.id) ? 1 : 0.5) * u()}
                stroke="#ffffff"
                lineWidth={hit.has(patch.node.id) ? 5 : 3}
            />
        )
    }
    console.log(count)

    view.add(
        <Line
            points={[ line.from, line.to ]}
            stroke="#ffffff"
            lineWidth={4}
        />
    )

    view.add(
        <Ray
            from={ray.o}
            to={vec2f_add(ray.o, vec2f_multiply(ray.d, endT))}
            stroke="#ffffff"
            lineWidth={8}
            endArrow
        />
    )

    yield* t(0, 0).to(1, 2).to(0, 2)
});
