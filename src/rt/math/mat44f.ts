import { Vector4f } from './vec4f'

export interface Matrix44f {
    x: Vector4f
    y: Vector4f
    z: Vector4f
    w: Vector4f
}

export function mat44f_multiply(a: Matrix44f, b: Vector4f): Vector4f {
    return {
        x: vec4f_dot(a.x, b),
        y: vec4f_dot(a.y, b),
        z: vec4f_dot(a.z, b),
        w: vec4f_dot(a.w, b),
    }
}
