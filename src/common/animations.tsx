import { Node } from '@motion-canvas/2d'
import { all } from '@motion-canvas/core'

export function* wiggle(node: Node, time = 1.5, times = 1.5, scale = 1) {
    const rot = node.rotation()
    node.rotation(rot - 20)
    node.scale(scale / 2)
    //node.opacity(scale)

    yield* all(
        node.rotation(rot, time, t =>
            1 - Math.sin(times * 2 * Math.PI * t) * Math.sin(Math.PI * t)
        ),
        //node.opacity(1, time),
        node.scale(1, time, t => scale * (1 - t) + t + Math.sin(Math.PI * t))
    )
}
