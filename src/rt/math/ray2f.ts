import * as quartic from 'quartic'
import { Matrix33f, mat33f_inverse, mat33f_multiply } from './mat33f'
import { Vector2f, vec2f, vec2f_add, vec2f_copy, vec2f_multiply, vec2f_normalized, vec2f_sub } from './vec2f'
import { vec3f_homogeneous_project } from './vec3f'

const eps = 1e-3

export interface Ray2f {
    o: Vector2f
    d: Vector2f
}

export function ray2f_evaluate(ray: Ray2f, t: number) {
    return vec2f_add(ray.o, vec2f_multiply(ray.d, t))
}

export function ray2f_transform(ray: Ray2f, t: Matrix33f) {
    return {
        o: vec3f_homogeneous_project(mat33f_multiply(t, { ...ray.o, z: 1 })),
        d: mat33f_multiply(t, { ...ray.d, z: 0 }),
    }
}

export interface Bounds2f {
    min: Vector2f
    max: Vector2f
}

export function bounds2f_center(bounds: Bounds2f) {
    return vec2f_multiply(vec2f_add(bounds.min, bounds.max), 0.5)
}

export function bounds2f_copy(a: Bounds2f): Bounds2f {
    return {
        min: vec2f_copy(a.min),
        max: vec2f_copy(a.max),
    }
}

export interface Line2f {
    from: Vector2f
    to: Vector2f
}

export function line2f_intersect(line: Line2f, ray: Ray2f) {
    const d = vec2f_sub(line.to, line.from)
    const r = vec2f_sub(ray.o, line.from)

    const denom = ray.d.x * d.y - ray.d.y * d.x
    if (denom == 0) return Infinity

    const u = (ray.d.x * r.y - ray.d.y * r.x) / denom
    const t = (d.x * r.y - d.y * r.x) / denom
    if (u < 0 || u > 1) return Infinity

    return t
}

/**
 * y(x) = c4 * x^4 + c2 * x^2 + c0, for x in [-1,1]
 */
export interface Curve2f {
    t: Matrix33f
    c0: number
    c2: number
    c4: number
}

export function curve2f_eval(curve: Curve2f, x: number) {
    const x2 = x*x
    const x4 = x2*x2
    return curve.c0 + curve.c2 * x2 + curve.c4 * x4
}

export function curve2f_normal(curve: Curve2f, x: number): Vector2f {
    const dy = 4 * curve.c4 * Math.pow(x, 3) + 2 * curve.c2 * x
    return vec2f_normalized(vec2f(-dy, 1))
}

export function curve2f_intersect(curve: Curve2f, ray: Ray2f) {
    const tinv = mat33f_inverse(curve.t)
    ray = ray2f_transform(ray, tinv)

    if (Math.abs(ray.d.x) < eps * Math.abs(ray.d.y)) {
        const x = ray.o.x
        if (x >= -1 && x <= +1) {
            const y = curve2f_eval(curve, x)
            const t = (y - ray.o.y) / ray.d.y
            if (t > eps) {
                return { t, x }
            }
        }
        return { t: Infinity, x }
    }

    // ray
    // x = ox + t * dx => t = (x - ox) / dx
    // y = oy + t * dy => y = oy + (x - ox) * (dy / dx)

    // curve
    // y = c4 * c^4 + c2 * x^2

    const xs = quartic([
        curve.c4,
        0,
        curve.c2,
        -ray.d.y / ray.d.x,
        curve.c0 + -ray.o.y + ray.o.x * ray.d.y / ray.d.x
    ])
    for (const xcomplex of xs) {
        if (xcomplex.im != 0) continue
        const x = xcomplex.re
        if (x < -1 || x > +1) continue
        const y = curve2f_eval(curve, x)
        const t = (y - ray.o.y) / ray.d.y
        if (t > eps) {
            return { t, x }
        }
    }
    return { t: Infinity, x: ray.o.x }
}