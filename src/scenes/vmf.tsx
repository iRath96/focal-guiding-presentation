import {Line, Ray, Txt, makeScene2D} from '@motion-canvas/2d'
import { createSignal } from '@motion-canvas/core';
import { Vector2f, vec2f, vec2f_dot, vec2f_multiply, vec2f_normalized, vec2f_reflect } from '../rt/math';



function phong(
    normal: Vector2f, wi: Vector2f, exp: number,
    segments: number
) {
    const wr = vec2f_reflect(normal, wi)

    let points: Vector2f[] = []
    for (let i = 0; i <= segments; i++) {
        const theta = 2 * Math.PI * ((i + 0.5) / segments)
        const wo = vec2f(Math.cos(theta), Math.sin(theta))

        const y = Math.sin(theta)
        const cosThetaWo = Math.max(vec2f_dot(normal, wo), 0)
        const cosThetaWr = Math.max(vec2f_dot(wo, wr), 0)

        let r = cosThetaWo * Math.pow(cosThetaWr, exp) * (Math.sqrt(exp) + 2) / (2 * Math.PI)
        if (r < 1e-8) r = 0

        points.push(vec2f_multiply(wo, 400 * r))
    }

    //console.log(points)
    return points
}

export default makeScene2D(function* (view) {
    const phongExpSqrt = createSignal(0)
    const phongExp = () => Math.pow(phongExpSqrt(), 2)
    const normal = vec2f(0, -1)
    const wi = createSignal<Vector2f>(vec2f_normalized(vec2f(-1, -1)))

    view.add(
        <Line
            points={[
                [ -300, 0 ],
                [ +300, 0 ],
            ]}
            stroke="#ffffff"
            lineWidth={8}
            zIndex={2}
        />
    )

    view.add(
        <Ray
            from={() => vec2f_multiply(wi(), 200)}
            to={[0,0]}
            stroke="#ffffff"
            lineWidth={4}
            zIndex={2}
            endArrow
        />
    )

    view.add(
        <Line
            points={() => phong(normal, wi(), phongExp(), 512)}
            stroke="rgb(10, 103, 255)"
            lineWidth={4}
            fill="rgba(10, 103, 255, 0.2)"
        />
    )

    view.add(
        <Txt
            text={() => `Exponent: ${phongExp().toFixed(1)}`}
            fill={"#fff"}
            position={[0, 100]}
        />
    )

    yield* phongExpSqrt(1e-8, 0).to(10, 3).to(1e-8, 3)
});
