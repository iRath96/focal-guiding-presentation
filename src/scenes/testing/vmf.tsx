import {Line, Ray, Txt, makeScene2D} from '@motion-canvas/2d'
import { createSignal } from '@motion-canvas/core';
import { Vector2f, vec2f, vec2f_dot, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect } from '../rt/math';
import { colors } from '../../common';

function theta_linspace(i: number, n: number) {
    return 2 * Math.PI * ((i + 0.5) / n)
}

function phong(
    normal: Vector2f, wi: Vector2f, exp: number,
    segments: number
) {
    const wr = vec2f_reflect(normal, wi)

    let pdfs: number[] = []
    for (let i = 0; i <= segments; i++) {
        const theta = theta_linspace(i, segments)
        const wo = vec2f_polar(theta)

        const y = Math.sin(theta)
        const cosThetaWo = Math.max(vec2f_dot(normal, wo), 0)
        const cosThetaWr = Math.max(vec2f_dot(wo, wr), 0)

        let r = cosThetaWo * Math.pow(cosThetaWr, exp) * (Math.sqrt(exp) + 2) / (2 * Math.PI)
        if (r < 1e-8) r = 0

        pdfs.push(r)
    }

    return pdfs
}

function sample(radii: number[], rng: number[]) {
    // normalize
    const sum = radii.reduce((sum, r) => sum + r, 0)
    radii = radii.map(r => r / sum)

    return rng.map(u => {
        for (let i = 0; i < radii.length; i++) {
            if (u < radii[i]) {
                u /= radii[i]
                return i + u
            }
            u -= radii[i]
        }
        return 0
    })
}

function polar(radii: number[], scale: number) {
    let points: Vector2f[] = []
    for (let i = 0; i <= radii.length; i++) {
        const theta = theta_linspace(i, radii.length)
        const radius = Math.sqrt(radii[i % radii.length])
        points.push(vec2f_polar(theta, scale * radius))
    }

    return points
}

function linspace(n: number) {
    const v: number[] = []
    for (let i = 0; i < n; i++) {
        v.push((i + 0.5) / n)
    }
    return v
}

function linear_lookup(v: number[], i: number) {
    const iInt = Math.floor(i)
    const iFrac = i - iInt
    return (1 - iFrac) * v[iInt % v.length] + iFrac * v[(iInt + 1) % v.length]
}

export default makeScene2D(function* (view) {
    const phongExpSqrt = createSignal(0)
    const phongExp = () => Math.pow(phongExpSqrt(), 2)
    const normal = vec2f(0, -1)
    const wi = createSignal<Vector2f>(vec2f_normalized(vec2f(-1, -1)))
    const samples = createSignal(() => {
        const n = 256
        const dist = phong(normal, wi(), phongExp(), n)
        const rngs = linspace(4)
        return sample(dist, rngs).map(i => vec2f_polar(
            theta_linspace(i, n), Math.sqrt(linear_lookup(dist, i))
        ))
    })

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
            points={() => polar(phong(normal, wi(), phongExp(), 512), 400)}
            stroke="rgb(10, 103, 255)"
            lineWidth={4}
            fill="rgba(10, 103, 255, 0.2)"
        />
    )

    view.add(
        <Txt
            text={() => `Exponent: ${phongExp().toFixed(1)}`}
            fill={colors.white}
            position={[0, 100]}
        />
    )

    for (let i = 0; i < samples().length; i++) {
        view.add(
            <Ray
                from={[0,0]}
                to={() => vec2f_multiply(samples()[i], 400)}
                stroke="rgb(10, 103, 255)"
                lineWidth={4}
                endArrow
            />
        )
    }

    yield* phongExpSqrt(1e-8, 0).to(10, 3).to(1e-8, 3)
});
