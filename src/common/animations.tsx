import { Node } from '@motion-canvas/2d'
import { all } from '@motion-canvas/core'

export function* wiggle(node: Node, time: number = 1.5, times = 1.5) {
    const rot = node.rotation()
    node.rotation(rot - 20)
    node.scale(0.5)

    yield* all(
        node.rotation(rot, time, t =>
            1 - Math.sin(times * 2 * Math.PI * t) * Math.sin(Math.PI * t)
        ),
        node.scale(1, time, t => 1 + Math.sin(Math.PI * t))
    )
}
