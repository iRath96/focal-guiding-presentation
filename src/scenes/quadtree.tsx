import {Rect, makeScene2D} from '@motion-canvas/2d'
import { Bounds2f, Vector2f, bounds2f_center, vec2f, vec2f_add, vec2f_copy, vec2f_multiply, vec2f_sub } from '../rt/math';
import { createSignal } from '@motion-canvas/core';

interface QuadTreeNode {
    accumulator: number
    density: number
    children?: QuadTreeNode[]
}

interface QuadTreePatch {
    density: number
    bounds: Bounds2f
}

class QuadTree {
    private root: QuadTreeNode = {
        accumulator: 0,
        density: 0,
    }

    constructor(
        private bounds: Bounds2f,
        private minDepth: number,
        private maxDepth: number,
    ) {
        this.rebuild()
        console.log(this.root)
    }

    private rebuildNode(node: QuadTreeNode, depth: number) {
        const wasSplit = node.children != undefined
        const canBeSplit = depth < this.maxDepth
        const wantsToBeSplit = depth < this.minDepth
        const willBeSplit = canBeSplit && wantsToBeSplit

        if (wasSplit && !willBeSplit) {
            delete node.children
        }

        if (!wasSplit && willBeSplit) {
            node.children = []
            for (let i = 0; i < 4; i++) {
                node.children.push({
                    accumulator: node.accumulator / 4,
                    density: node.density / 4,
                })
            }
        }

        if (willBeSplit) {
            for (const child of node.children) {
                this.rebuildNode(child, depth + 1)
            }
        }
    }

    private rebuild() {
        this.rebuildNode(this.root, 0)
    }

    private collectPatches(node: QuadTreeNode, bounds: Bounds2f): QuadTreePatch[] {
        if (node.children == undefined) {
            return [{
                density: node.density,
                bounds
            }]
        }

        const mid = bounds2f_center(bounds)
        const childBounds = (i: number) => {
            let b = { min: vec2f_copy(bounds.min), max: vec2f_copy(bounds.max) }
            b[i & 1 ? "min" : "max"].x = mid.x
            b[i & 2 ? "min" : "max"].y = mid.y
            return b
        }

        return node.children.reduce((patches, child, i) =>
            [ ...patches, ...this.collectPatches(child, childBounds(i)) ]
        , [])
    }

    public visualize() {
        return this.collectPatches(this.root, this.bounds)
    }
}

function easeOutBack(x: number): number {
    const c1 = 2
    const c3 = c1 + 1;
    
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export default makeScene2D(function* (view) {
    const quadtree = new QuadTree({
        min: vec2f(-400, -400),
        max: vec2f(400, 400),
    }, 3, 16)

    const t = createSignal(0)

    for (const patch of quadtree.visualize()) {
        const center = bounds2f_center(patch.bounds)
        const startT = (center.x - center.y + 900) / 2100
        const u = () => {
            const u = (t() - startT) * 5
            return Math.min(Math.max(u, 0), 1)
        }
        view.add(
            <Rect
                position={center}
                size={() => vec2f_multiply(vec2f_sub(patch.bounds.max, patch.bounds.min),
                    easeOutBack(u())
                )}
                opacity={() => 0.5*u()}
                //rotation={() => 10*(1-u())}
                stroke="#ffffff"
                lineWidth={2}
            />
        )
    }

    yield* t(0, 0).to(1, 2).to(0, 2)
});
