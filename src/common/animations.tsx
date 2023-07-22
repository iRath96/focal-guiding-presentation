import { Node } from '@motion-canvas/2d'

export function* wiggle(node: Node, time: number, times = 1) {
    const rot = node.rotation()
    node.rotation(rot - 20)
    yield* node.rotation(rot, time, t =>
        1 - Math.sin(times * 2 * Math.PI * t) * Math.sin(Math.PI * t))
}
