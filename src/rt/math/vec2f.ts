export interface Vector2f {
    x: number
    y: number
}

export function vec2f(x: number, y: number): Vector2f {
    return { x, y }
}

export function vec2f_direction(from: Vector2f, to: Vector2f) {
    return vec2f_normalized(vec2f_sub(to, from))
}

export function vec2f_distance(from: Vector2f, to: Vector2f) {
    return vec2f_length(vec2f_sub(to, from))
}

export function vec2f_lerp(a: Vector2f, b: Vector2f, t: number) {
    return {
        x: (1 - t) * a.x + t * b.x,
        y: (1 - t) * a.y + t * b.y,
    }
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

export function vec2f_multiply(a: Vector2f, b: number): Vector2f {
    return {
        x: a.x * b,
        y: a.y * b,
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

export function vec2f_minus(a: Vector2f): Vector2f {
    return {
        x: -a.x,
        y: -a.y,
    }
}

export function vec2f_dot(a: Vector2f, b: Vector2f): number {
    return a.x * b.x + a.y * b.y
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
