import { Line, makeScene2D } from "@motion-canvas/2d";
import { debug, waitUntil } from "@motion-canvas/core";
import { contours } from "../common/contours";
import { Vector2f, vec2f } from "../rt/math";

export default makeScene2D(function* (view) {
    const f = (p: Vector2f) => {
        return Math.exp(-Math.pow(p.x / 300, 2) - Math.pow(p.y / 300, 2)) +
            Math.exp(-Math.pow(p.x / 100 + 4, 2) - Math.pow(p.y / 100 + 0.2, 2))
    }
    for (const threshold of [ 0.3, 0.5, 0.8 ]) {
        const c = contours({ f, threshold, res: 128, bounds: {
            min: vec2f(-600, -600),
            max: vec2f(+600, +600)
        }})
        for (const loop of c) {
            view.add(<Line
                points={loop}
                lineWidth={4}
                fill={"rgba(255, 127, 0, 0.2)"}
                stroke={"rgba(255, 255, 255, 0.5)"}
            />)
        }
    }
    yield* waitUntil('intro/done')
});
