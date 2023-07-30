import * as quartic from 'quartic'
import { Matrix33f, mat33f_inverse, mat33f_multiply } from './mat33f'
import { Vector2f, vec2f, vec2f_add, vec2f_angle, vec2f_copy, vec2f_direction, vec2f_dot, vec2f_length, vec2f_lerp, vec2f_multiply, vec2f_normalized, vec2f_pdivide, vec2f_plerp, vec2f_polar, vec2f_squared_length, vec2f_sub } from './vec2f'
import { vec3f, vec3f_homogeneous_project } from './vec3f'

const eps = 1e-3

export function sample_hemicircle(n: Vector2f, u: number) {
    const uv = vec2f_polar(Math.PI * u)
    return vec2f_add(
        vec2f_multiply(n, uv.y),
        vec2f_multiply(vec2f(-n.y, n.x), uv.x),
    )
}

export interface Ray2f {
    o: Vector2f
    d: Vector2f
}

export function ray2f_targeting(from: Vector2f, to: Vector2f): Ray2f {
    return {
        o: from,
        d: vec2f_direction(from, to),
    }
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

export function bounds2f_evaluate(bounds: Bounds2f, p: Vector2f) {
    return vec2f_plerp(bounds.min, bounds.max, p)
}

export function bounds2f_diagonal(bounds: Bounds2f) {
    return vec2f_sub(bounds.max, bounds.min)
}

export function bounds2f_center(bounds: Bounds2f) {
    return vec2f_lerp(bounds.min, bounds.max, 0.5)
}

export function bounds2f_relative(bounds: Bounds2f, p: Vector2f) {
    return vec2f_pdivide(vec2f_sub(p, bounds.min), bounds2f_diagonal(bounds))
}

export function bounds2f_copy(a: Bounds2f): Bounds2f {
    return {
        min: vec2f_copy(a.min),
        max: vec2f_copy(a.max),
    }
}

export interface Circle2f {
    center: Vector2f
    radius: number
}

export function circle2f_towards(circle: Circle2f, target: Vector2f) {
    return vec2f_add(circle.center,
        vec2f_multiply(
            vec2f_direction(circle.center, target),
            circle.radius
        )
    )
}

export function circle2f_evaluate(circle: Circle2f, t: number) {
    return vec2f_add(circle.center,
        vec2f_polar(2 * Math.PI * t, circle.radius))
}

export function circle2f_normal(circle: Circle2f, p: Vector2f) {
    return vec2f_direction(circle.center, p)
}

export function circle2f_intersect(circle: Circle2f, ray: Ray2f) {
    const omc = vec2f_sub(ray.o, circle.center)
    const ph = vec2f_dot(omc, ray.d)
    const q = vec2f_squared_length(omc) - circle.radius * circle.radius

    const rad = ph * ph - q
    if (rad < 0) return Infinity

    const s = Math.sqrt(rad)
    const t1 = -ph - s
    if (t1 > 0) return t1
    const t2 = -ph + s
    if (t2 > 0) return t2

    return Infinity
}

export interface Line2f {
    from: Vector2f
    to: Vector2f
}

export function line2f_span(line: Line2f) {
    return vec2f_sub(line.to, line.from)
}

export function line2f_length(line: Line2f) {
    return vec2f_length(line2f_span(line))
}

export function line2f_angle(line: Line2f) {
    return vec2f_angle(line2f_span(line))
}

export function line2f_evaluate(line: Line2f, t: number) {
    return vec2f_lerp(line.from, line.to, t)
}

export function line2f_normal(line: Line2f) {
    const d = vec2f_sub(line.to, line.from)
    return vec2f_normalized(vec2f(-d.y, d.x))
}

export function line2f_intersect(line: Line2f, ray: Ray2f) {
    const d = vec2f_sub(line.to, line.from)
    const r = vec2f_sub(ray.o, line.from)

    const denom = ray.d.x * d.y - ray.d.y * d.x
    if (denom == 0) return Infinity

    const u = (ray.d.x * r.y - ray.d.y * r.x) / denom
    const t = (d.x * r.y - d.y * r.x) / denom
    if (u < 0 || u > 1) return Infinity

    if (t < 0) return Infinity
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

export function curve2f_rasterize(curve: Curve2f, segments: number) {
    const points: ([number, number])[] = []
    for (let i = 0; i < segments; i++) {
        const x = 2 * i / (segments - 1) - 1
        const y = curve2f_eval(curve, x)
        const p = vec3f_homogeneous_project(mat33f_multiply(curve.t, vec3f(x, y, 1)))
        points.push([ p.x, p.y ])
    }
    return points
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
    for (let i = 0; i < 4; i++) {
        const xcomplex = xs[i]
        if (curve.c2 == 0 && i == 1) continue
        if (curve.c4 == 0 && (i == 2 || i == 3)) continue
        if (xcomplex.im != 0) continue
        const x = xcomplex.re
        if (x < -1 || x > +1) continue
        const y = curve2f_eval(curve, x)
        const t = (y - ray.o.y) / ray.d.y
        if (t >= 0) {
            return { t, x }
        }
    }
    return { t: Infinity, x: ray.o.x }
}