import { Vector3f } from './vec3f'

export interface Vector4f {
    x: number
    y: number
    z: number
    w: number
}

export function vec4f_dot(a: Vector4f, b: Vector4f): number {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
}

export function vec4f_homogeneous_project(a: Vector4f): Vector3f {
    return {
        x: a.x / a.w,
        y: a.y / a.w,
        z: a.z / a.w,
    }
}
