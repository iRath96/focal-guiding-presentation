import { Vector3f, vec3f, vec3f_dot } from './vec3f'

export interface Matrix33f {
    x: Vector3f
    y: Vector3f
    z: Vector3f
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
