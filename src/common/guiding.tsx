import { Vector2f, vec2f_polar } from '../rt/math'

export function saturate(v: number) {
    return Math.max(0, Math.min(1, v))
}

export function theta_linspace(i: number, n: number) {
    return 2 * Math.PI * ((i + 0.5) / n)
}

export function sample(radii: number[], rng: number[]) {
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

export function polar_plot(radii: number[], scale: number) {
    let points: Vector2f[] = []
    for (let i = 0; i <= radii.length; i++) {
        const theta = theta_linspace(i, radii.length)
        const radius = Math.sqrt(radii[i % radii.length])
        points.push(vec2f_polar(theta, scale * radius))
    }

    return points
}

export function linspace(n: number) {
    const v: number[] = []
    for (let i = 0; i < n; i++) {
        v.push((i + 0.5) / n)
    }
    return v
}

export function linear_lookup(v: number[], i: number) {
    const iInt = Math.floor(i)
    const iFrac = i - iInt
    return (1 - iFrac) * v[iInt % v.length] + iFrac * v[(iInt + 1) % v.length]
}
