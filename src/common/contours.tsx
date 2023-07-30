import { debug } from "@motion-canvas/core"
import { Bounds2f, Vector2f, bounds2f_evaluate, vec2f, vec2f_add, vec2f_length, vec2f_lerp, vec2f_multiply, vec2f_zero } from "../rt/math"

// side indices:
// x--- 0 ---x
// |         |
// 3         1
// |         |
// x--- 2 ---x

const contourCases: {
    from: number
    to: number
}[][] = [
    [],
    [{ from: 3, to: 2 }],
    [{ from: 2, to: 1 }],
    [{ from: 3, to: 1 }],

    [{ from: 1, to: 0 }],
    [{ from: 1, to: 0 }, { from: 3, to: 2 }], // TODO: ambiguity
    [{ from: 2, to: 0 }],
    [{ from: 3, to: 0 }],

    [{ from: 0, to: 3 }],
    [{ from: 0, to: 2 }],
    [{ from: 0, to: 3 }, { from: 2, to: 1 }], // TODO: ambiguity
    [{ from: 0, to: 1 }],

    [{ from: 1, to: 3 }],
    [{ from: 1, to: 2 }],
    [{ from: 2, to: 3 }],
    []
]

export interface ContoursOptions {
    f(x: Vector2f): number
    threshold: number
    bounds: Bounds2f
    res: number
}
export function contours($: ContoursOptions) {
    const values = new Float32Array($.res * $.res);
    for (let y = 0; y < $.res; y++) {
        for (let x = 0; x < $.res; x++) {
            values[y * $.res + x] = $.f(
                bounds2f_evaluate(
                    $.bounds,
                    vec2f((x + 0.5) / $.res, (y + 0.5) / $.res)
                )
            ) - $.threshold;
            if (x == 0 || y == 0 || x == $.res - 1 || y == $.res - 1) {
                values[y * $.res + x] = -1;
            }
        }
    }

    const edges = new Map<number, number>()
    const vertices = new Map<number, Vector2f>()

    const edgeOffsets = [0, 2 + 1, 2 * $.res, 1]
    for (let y = 0; y < $.res - 1; y++) {
        for (let x = 0; x < $.res - 1; x++) {
            const edgeBase = 2 * (y * $.res + x)

            const f00 = values[y * $.res + x]
            const f10 = values[y * $.res + x + 1]
            const f01 = values[(y + 1) * $.res + x]
            const f11 = values[(y + 1) * $.res + x + 1]
            const idx = (f01 > 0 ? 1 : 0) |
                (f11 > 0 ? 2 : 0) |
                (f10 > 0 ? 4 : 0) |
                (f00 > 0 ? 8 : 0)
            ;

            for (const edge of contourCases[idx]) {
                const e0 = edgeBase + edgeOffsets[edge.from]
                const e1 = edgeBase + edgeOffsets[edge.to]
                edges.set(e0, e1)
                //debug(`Edge[${idx}] ${e0} -> ${e1} at ${x}, ${y}`)
                if (vertices.has(e0)) {
                    debug(`Vertex ${e0} already exists!`)
                }

                const p = vec2f_zero()
                switch (edge.from) {
                case 0:
                    p.x = Math.sign(f00) * (f00 + f10) / (f00 - f10);
                    p.y = -1;
                    break;
                case 1:
                    p.x = +1;
                    p.y = Math.sign(f10) * (f10 + f11) / (f10 - f11);
                    break;
                case 2:
                    p.x = Math.sign(f11) * (f01 + f11) / (f01 - f11);
                    p.y = +1;
                    break;
                case 3:
                    p.x = -1;
                    p.y = Math.sign(f01) * (f00 + f01) / (f00 - f01);
                    break;
                }
                vertices.set(e0, bounds2f_evaluate($.bounds,
                    vec2f_add(
                        vec2f((x + 1) / $.res, (y + 1) / $.res),
                        vec2f_multiply(p, 0.5 / $.res),
                    )
                ))
            }
        }
    }

    //debug([ ...edges.keys() ])
    //debug([ ...vertices.keys() ])

    const loops: Vector2f[][] = []
    const emittedEdges = new Set<number>()
    for (const edge of edges.keys()) {
        if (emittedEdges.has(edge)) continue
        
        let loop: Vector2f[] = [ vertices.get(edge) ]
        let e = edge
        let i = 0
        do {
            emittedEdges.add(e);
            if (!edges.has(e)) {
                debug(`Edge ${e} linkes to nothing!`)
                break
            }
            e = edges.get(e);
            if (!edges.has(e)) {
                debug(`Edge ${e} has no vertex!`)
                //break
            }
            loop.push(vertices.get(e));
        } while (e != edge);

        loops.push(loop)
    }

    return loops
}
