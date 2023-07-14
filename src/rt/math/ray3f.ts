import { Vector2f } from './vec2f'
import { Vector3f, vec3f, vec3f_add, vec3f_cross, vec3f_dot, vec3f_multiply, vec3f_normalized, vec3f_sub } from './vec3f'

const eps = 1e-3

export interface Ray3f {
    o: Vector3f
    d: Vector3f
}

export interface Quad3f {
    base: Vector3f
    span1: Vector3f
    span2: Vector3f
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

export interface Scene3f {
    quads: Quad3f[]
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
