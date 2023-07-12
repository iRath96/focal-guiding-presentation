import * as quartic from 'quartic'

const eps = 1e-3

export interface Vector2f {
    x: number
    y: number
}

export interface Vector3f {
    x: number
    y: number
    z: number
}

export interface Matrix33f {
    x: Vector3f
    y: Vector3f
    z: Vector3f
}

export interface Vector4f {
    x: number
    y: number
    z: number
    w: number
}

export interface Matrix44f {
    x: Vector4f
    y: Vector4f
    z: Vector4f
    w: Vector4f
}

export interface Bounds2f {
    min: Vector2f
    max: Vector2f
}

export function bounds2f_center(bounds: Bounds2f) {
    return vec2f_multiply(vec2f_add(bounds.min, bounds.max), 0.5)
}

export function vec2f(x: number, y: number): Vector2f {
    return { x, y }
}

export function vec3f(x: number, y: number, z: number): Vector3f {
    return { x, y, z }
}

export function vec2f_squared_length(a: Vector2f): number {
    return vec2f_dot(a, a)
}

export function vec2f_length(a: Vector2f): number {
    return Math.sqrt(vec2f_dot(a, a))
}

export function vec2f_normalized(a: Vector2f): Vector2f {
    return vec2f_multiply(a, 1 / vec2f_length(a))
}

export function vec3f_length(a: Vector3f): number {
    return Math.sqrt(vec3f_dot(a, a))
}

export function vec3f_normalized(a: Vector3f): Vector3f {
    return vec3f_multiply(a, 1 / vec3f_length(a))
}

export function vec2f_multiply(a: Vector2f, b: number): Vector2f {
    return {
        x: a.x * b,
        y: a.y * b,
    }
}

export function vec3f_multiply(a: Vector3f, b: number): Vector3f {
    return {
        x: a.x * b,
        y: a.y * b,
        z: a.z * b,
    }
}

export function vec2f_copy(a: Vector2f): Vector2f {
    return {
        x: a.x,
        y: a.y,
    }
}

export function vec2f_add(a: Vector2f, b: Vector2f): Vector2f {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
    }
}

export function vec2f_sub(a: Vector2f, b: Vector2f): Vector2f {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
    }
}

export function vec3f_add(a: Vector3f, b: Vector3f): Vector3f {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
    }
}

export function vec3f_sub(a: Vector3f, b: Vector3f): Vector3f {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    }
}

export function vec3f_cross(a: Vector3f, b: Vector3f): Vector3f {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    }
}

export function vec2f_dot(a: Vector2f, b: Vector2f): number {
    return a.x * b.x + a.y * b.y
}

export function vec3f_dot(a: Vector3f, b: Vector3f): number {
    return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vec4f_dot(a: Vector4f, b: Vector4f): number {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
}

export function vec3f_homogeneous_project(a: Vector3f): Vector2f {
    return {
        x: a.x / a.z,
        y: a.y / a.z,
    }
}

export function vec4f_homogeneous_project(a: Vector4f): Vector3f {
    return {
        x: a.x / a.w,
        y: a.y / a.w,
        z: a.z / a.w,
    }
}

export function mat33f_determinant(a: Matrix33f): number {
    return a.x.x * (a.y.y * a.z.z - a.z.y * a.y.z) -
        a.x.y * (a.y.x * a.z.z - a.y.z * a.z.x) +
        a.x.z * (a.y.x * a.z.y - a.y.y * a.z.x)
}

export function mat33f_inverse(a: Matrix33f): Matrix33f {
    const invdet = 1 / mat33f_determinant(a)
    return {
        x: vec3f(
            invdet * (a.y.y * a.z.z - a.z.y * a.y.z),
            invdet * (a.x.z * a.z.y - a.x.y * a.z.z),
            invdet * (a.x.y * a.y.z - a.x.z * a.y.y)),
        y: vec3f(
            invdet * (a.y.z * a.z.x - a.y.x * a.z.z),
            invdet * (a.x.x * a.z.z - a.x.z * a.z.x),
            invdet * (a.y.x * a.x.z - a.x.x * a.y.z)),
        z: vec3f(
            invdet * (a.y.x * a.z.y - a.z.x * a.y.y),
            invdet * (a.z.x * a.x.y - a.x.x * a.z.y),
            invdet * (a.x.x * a.y.y - a.y.x * a.x.y)),
    }
}

export function mat33f_multiply(a: Matrix33f, b: Vector3f): Vector3f {
    return {
        x: vec3f_dot(a.x, b),
        y: vec3f_dot(a.y, b),
        z: vec3f_dot(a.z, b),
    }
}

export function mat44f_multiply(a: Matrix44f, b: Vector4f): Vector4f {
    return {
        x: vec4f_dot(a.x, b),
        y: vec4f_dot(a.y, b),
        z: vec4f_dot(a.z, b),
        w: vec4f_dot(a.w, b),
    }
}

export function vec2f_refract(n: Vector2f, w: Vector2f, eta: number): Vector2f {
    const nDotW = vec2f_dot(n, w)
    const k = 1 - eta * eta * (1 - nDotW * nDotW)
    if (k < 0) return vec2f(0, 0)

    return vec2f_add(
        vec2f_multiply(w, eta),
        vec2f_multiply(n, -(eta * nDotW + Math.sqrt(k)))
    )
}

export function vec2f_reflect(n: Vector2f, w: Vector2f): Vector2f {
    return vec2f_sub(vec2f_multiply(n, 2 * vec2f_dot(w, n)), w)
}

export function vec2f_polar(angle: number, radius: number = 1): Vector2f {
    return vec2f(radius * Math.cos(angle), radius * Math.sin(angle))
}

export interface Ray2f {
    o: Vector2f
    d: Vector2f
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

export interface Ray3f {
    o: Vector3f
    d: Vector3f
}

export interface Quad3f {
    base: Vector3f
    span1: Vector3f
    span2: Vector3f
}

export interface Scene3f {
    quads: Quad3f[]
}

export function quad3f_intersect(ray: Ray3f, quad: Quad3f) {
    const pvec = vec3f_cross(ray.d, quad.span2)
    const det = vec3f_dot(pvec, quad.span1)

    if (Math.abs(det) > eps) {
        const tvec = vec3f_sub(ray.o, quad.base)
        const qvec = vec3f_cross(tvec, quad.span1)

        const u = vec3f_dot(tvec, pvec) / det
        const v = vec3f_dot(ray.d, qvec) / det

        if (u < -eps || v < -eps || u > 1+eps || v > 1+eps) {
            return Infinity
        }

        const dist = vec3f_dot(qvec, quad.span2) / det
        if (dist > eps) {
            return dist
        }
    }

    return Infinity
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

export function scene3f_intersect(ray: Ray3f, scene: Scene3f) {
    let bestT = Infinity
    for (const quad of scene.quads) {
        const candidateT = quad3f_intersect(ray, quad)
        bestT = Math.min(bestT, candidateT)
    }
    return bestT
}

export class PerspectiveCamera3f {
    private stepX: Vector3f
    private stepY: Vector3f
    private stepZ: Vector3f

    constructor(
        private origin: Vector3f,
        forward: Vector3f,
        up: Vector3f,
        vfov: number,
        hfov: number,
    ) {
        this.stepZ = vec3f_normalized(forward)

        const rightAxis = vec3f_normalized(vec3f_cross(this.stepZ, up))
        const upAxis = vec3f_cross(rightAxis, this.stepZ)

        hfov = Math.PI / 180 * hfov
        vfov = Math.PI / 180 * vfov

        this.stepX = vec3f_multiply(rightAxis, Math.tan(hfov / 2))
        this.stepY = vec3f_multiply(upAxis, Math.tan(vfov / 2))
    }

    public sample(pixel: Vector2f): Ray3f {
        return {
            o: this.origin,
            d: vec3f_normalized(
                vec3f_add(this.stepZ,
                    vec3f_add(
                        vec3f_multiply(this.stepX, pixel.x),
                        vec3f_multiply(this.stepY, pixel.y)
                    ))
                )
        }
    }
}

export function quad3f_box(): Quad3f[] {
    const result: Quad3f[] = [
        { base: vec3f(0, 0, 0), span1: vec3f( 0, 0, 1), span2: vec3f( 0, 1, 0) },
        { base: vec3f(0, 0, 0), span1: vec3f( 0, 0, 1), span2: vec3f( 1, 0, 0) },
        { base: vec3f(0, 0, 0), span1: vec3f( 0, 1, 0), span2: vec3f( 1, 0, 0) },
        { base: vec3f(1, 1, 1), span1: vec3f( 0, 0,-1), span2: vec3f( 0,-1, 0) },
        { base: vec3f(1, 1, 1), span1: vec3f( 0, 0,-1), span2: vec3f(-1, 0, 0) },
        { base: vec3f(1, 1, 1), span1: vec3f( 0,-1, 0), span2: vec3f(-1, 0, 0) },
    ]
    return result
}
