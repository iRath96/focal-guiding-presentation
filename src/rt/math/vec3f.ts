import { Vector2f } from './vec2f'

export interface Vector3f {
    x: number
    y: number
    z: number
}

export function vec3f(x: number, y: number, z: number): Vector3f {
    return { x, y, z }
}

export function vec3f_length(a: Vector3f): number {
    return Math.sqrt(vec3f_dot(a, a))
}

export function vec3f_normalized(a: Vector3f): Vector3f {
    return vec3f_multiply(a, 1 / vec3f_length(a))
}

export function vec3f_multiply(a: Vector3f, b: number): Vector3f {
    return {
        x: a.x * b,
        y: a.y * b,
        z: a.z * b,
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

export function vec3f_dot(a: Vector3f, b: Vector3f): number {
    return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vec3f_homogeneous_project(a: Vector3f): Vector2f {
    return {
        x: a.x / a.z,
        y: a.y / a.z,
    }
}
