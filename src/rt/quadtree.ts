import { debug } from '@motion-canvas/core'
import {
    Bounds2f, Ray2f, Vector2f,
    bounds2f_center, bounds2f_copy, bounds2f_diagonal, bounds2f_relative, vec2f, vec2f_add, vec2f_copy, vec2f_multiply, vec2f_pmultiply
} from './math'

export interface QuadTreeNode {
    id: number
    accumulator: number
    density: number
    children?: QuadTreeNode[]
}

export interface QuadTreePatch {
    node: QuadTreeNode
    density: number
    bounds: Bounds2f
}

export interface QuadTreeTraversal {
    patch: QuadTreePatch
    t0: number
    t1: number
}

export class QuadTree {
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
        this.refine()
    }

    private* warpWithNode(
        uv: Vector2f, node: QuadTreeNode, offset: Vector2f, size: Vector2f
    ): Generator<Vector2f> {
        yield vec2f_add(offset, vec2f_pmultiply(uv, size))
        if (!node.children) return

        const n00 = node.children[0].density
        const n10 = node.children[1].density
        const n01 = node.children[2].density
        const n11 = node.children[3].density
        const sum = n00 + n01 + n10 + n11

        const pTop = sum > 0 ? (n00 + n10) / sum : 0.5
        let pLeft: number
        let index = 0

        if (uv.y < pTop) {
            uv.y /= pTop
            pLeft = sum > 0 ? n00 / (n00 + n10) : 0.5
        } else {
            uv.y = (uv.y - pTop) / (1 - pTop)
            pLeft = sum > 0 ? n01 / (n01 + n11) : 0.5
            offset.y += size.y / 2
            index += 2
        }

        if (uv.x < pLeft) {
            uv.x /= pLeft
        } else {
            uv.x = (uv.x - pLeft) / (1 - pLeft)
            offset.x += size.x / 2
            index += 1
        }

        yield* this.warpWithNode(uv, node.children[index], offset,
            vec2f_multiply(size, 0.5))
    }

    *warp(uv: Vector2f) {
        yield* this.warpWithNode(vec2f_copy(uv), this.root,
            vec2f_copy(this.bounds.min), bounds2f_diagonal(this.bounds))
    }

    private rebuildNode(node: QuadTreeNode, rootWeight: number, invarea: number) {
        if (node.accumulator > 0) {
            node.density = invarea * node.accumulator / rootWeight
        } else {
            node.density = 0
        }

        if (node.children) {
            for (const child of node.children) {
                this.rebuildNode(child, rootWeight, 4 * invarea)
            }
        }
    }

    private refineNode(node: QuadTreeNode, depth: number, rootWeight: number) {
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
                    density: node.density,
                })
            }
        }

        if (willBeSplit) {
            for (const child of node.children) {
                this.refineNode(child, depth + 1, rootWeight)
            }
        }

        // reset accumulator
        node.accumulator = 0
    }

    private propagateNode(node: QuadTreeNode): number {
        if (node.children) {
            node.accumulator = node.children.reduce((acc, child) =>
                acc + this.propagateNode(child), 0)
        }
        return node.accumulator
    }

    rebuild() {
        this.rebuildNode(this.root, this.propagateNode(this.root), 1)
    }

    refine() {
        this.refineNode(this.root, 0,
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

    private lookupNode(point: Vector2f, node: QuadTreeNode, bounds: Bounds2f): QuadTreePatch {
        const relative = bounds2f_relative(bounds, point)
        if (!node.children) return {
            node,
            density: node.density,
            bounds
        }

        const childIndex = (relative.x > 0.5 ? 1 : 0) | (relative.y > 0.5 ? 2 : 0);
        return this.lookupNode(point, node.children[childIndex], this.childBounds(bounds, childIndex))
    }

    public lookup(point: Vector2f) {
        return this.lookupNode(point, this.root, this.bounds)
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
