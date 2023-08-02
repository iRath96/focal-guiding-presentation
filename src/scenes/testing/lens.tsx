import { Circle, Latex, Layout, Line, Ray, Txt, View2D, makeScene2D, Node } from '@motion-canvas/2d';
import { SimpleSignal, all, createRef, createSignal, makeRef } from '@motion-canvas/core';
import { Curve2f, Line2f, Ray2f, Vector2f, curve2f_eval, curve2f_intersect, curve2f_normal, line2f_intersect, mat33f_multiply, ray2f_evaluate, vec2f, vec2f_add, vec2f_multiply, vec2f_normalized, vec2f_polar, vec2f_reflect, vec2f_refract, vec3f, vec3f_homogeneous_project } from '../rt/math';
import { colors } from '../../common';

function curve2f_rasterize(curve: Curve2f, segments: number) {
    const points: ([number, number])[] = []
    for (let i = 0; i < segments; i++) {
        const x = 2 * i / (segments - 1) - 1
        const y = curve2f_eval(curve, x)
        const p = vec3f_homogeneous_project(mat33f_multiply(curve.t, vec3f(x, y, 1)))
        points.push([ p.x, p.y ])
    }
    return points
}

interface LensPath {
    ray1: Ray2f
    hit1: Vector2f
    ray2: Ray2f
    hit2: Vector2f
    ray3: Ray2f
    hit3: Vector2f
}

interface ReflectorPath {
    ray1: Ray2f
    hit1: Vector2f
    ray2: Ray2f
    hit2: Vector2f
}

function makeLens(view: Node, curvature: SimpleSignal<number>) {
    const lightPos = vec2f(0, -200)
    const ior = createSignal<number>(3)

    const line: Line2f = {
        from: vec2f(100, -60),
        to: vec2f(-100, -60)
    }
    const curve = createSignal<Curve2f>(() => ({
        t: {
            x: vec3f(100,0,0),
            y: vec3f(0,100,-60),
            z: vec3f(0,0,1),
        },
        c0: -1.2 * curvature(),
        c2: curvature(),
        c4: -0.08 * curvature(),
    }))

    view.add(<Circle
        position={lightPos}
        size={20}
        fill={"#ffaa00"}
        zIndex={4}
    />)

    view.add(<Line
        points={() => [
            ...curve2f_rasterize(curve(), 64),
            line.from, line.to
        ]}
        closed
        fill="rgba(59, 91, 255, 0.5)"
        stroke="rgb(59, 91, 255)"
        lineWidth={4}
        zIndex={2}
    />)

    const rays: SimpleSignal<LensPath>[] = []
    for (let i = -5; i <= +5; i++) {
        const angle = i / 5 * Math.PI * 0.15 + Math.PI / 2
        const ray1: Ray2f = {
            o: lightPos,
            d: vec2f_polar(angle)
        }
        const isect1 = line2f_intersect(line, ray1)
        const hit1 = ray2f_evaluate(ray1, isect1)
        const ray2: Ray2f = {
            o: hit1,
            d: vec2f_refract(vec2f(0, -1), ray1.d, 1/ior())
        }
        rays.push(createSignal<LensPath>(() => {
            const isect2 = curve2f_intersect(curve(), ray2)
            const hit2 = ray2f_evaluate(ray2, isect2.t)
            const normal = vec2f_multiply(
                curve2f_normal(curve(), isect2.x), -1)
            const ray3: Ray2f = {
                o: hit2,
                d: vec2f_refract(normal, ray2.d, ior())
            }
            const hit3 = ray2f_evaluate(ray3, 1000)
            return { ray1, hit1, ray2, hit2, ray3, hit3 }
        }))
    }

    const apparentPosition = createSignal<Vector2f>(() => {
        const marginal = rays[0]().ray3
        const t = marginal.o.x / -marginal.d.x
        return vec2f(0, marginal.o.y + t * marginal.d.y)
    })

    for (const ray of rays) {
        view.add(<Ray
            from={() => ray().ray1.o}
            to={() => ray().hit1}
            stroke={colors.white}
            lineWidth={3}
        />)
        view.add(<Ray
            from={() => ray().ray2.o}
            to={() => ray().hit2}
            stroke={colors.white}
            lineWidth={3}
        />)
        view.add(<Ray
            from={() => ray().ray3.o}
            to={() => ray().hit3}
            stroke={colors.white}
            lineWidth={3}
            endArrow
        />)
        view.add(<Ray
            from={() => ray().ray3.o}
            to={() => ray2f_evaluate(ray().ray3, -1000)}
            stroke={colors.white}
            lineWidth={2}
            opacity={0.5}
            lineDash={[5,5]}
        />)
    }

    const apparentCircle = <Circle
        position={apparentPosition}
        size={20}
        stroke={"#ffaa00"}
        lineWidth={4}
    />
    view.add(apparentCircle)
}

function makeReflector(view: Node, curvature: SimpleSignal<number>) {
    const lightPos = vec2f(0, -200)

    const curve = createSignal<Curve2f>(() => ({
        t: {
            x: vec3f(100,0,0),
            y: vec3f(0,100,-400),
            z: vec3f(0,0,1),
        },
        c0: -1.2 * curvature(),
        c2: -curvature(),
        c4: -0.08 * curvature(),
    }))

    view.add(<Circle
        position={lightPos}
        size={20}
        fill={"#ffaa00"}
        zIndex={4}
    />)

    view.add(<Line
        points={() => [
            ...curve2f_rasterize(curve(), 64)
        ]}
        stroke="rgb(59, 91, 255)"
        lineWidth={4}
        zIndex={2}
    />)

    const rays: SimpleSignal<ReflectorPath>[] = []
    for (let i = -5; i <= +5; i++) {
        const angle = i / 5 * Math.PI * 0.13 - Math.PI / 2
        const ray1: Ray2f = {
            o: lightPos,
            d: vec2f_polar(angle)
        }
        rays.push(createSignal<ReflectorPath>(() => {
            const isect1 = curve2f_intersect(curve(), ray1)
            const hit1 = ray2f_evaluate(ray1, isect1.t)
            const normal = curve2f_normal(curve(), isect1.x)
            const ray2: Ray2f = {
                o: hit1,
                d: vec2f_reflect(normal, vec2f_multiply(ray1.d, -1))
            }
            const hit2 = ray2f_evaluate(ray2, 1000)
            return { ray1, hit1, ray2, hit2 }
        }))
    }

    const apparentPosition = createSignal<Vector2f>(() => {
        const marginal = rays[0]().ray2
        const t = marginal.o.x / -marginal.d.x
        return vec2f(0, marginal.o.y + t * marginal.d.y)
    })

    for (const ray of rays) {
        view.add(<Ray
            from={() => ray().ray1.o}
            to={() => ray().hit1}
            stroke={colors.white}
            lineWidth={3}
        />)
        view.add(<Ray
            from={() => ray().ray2.o}
            to={() => ray().hit2}
            stroke={colors.white}
            lineWidth={3}
            endArrow
        />)
        view.add(<Ray
            from={() => ray().ray2.o}
            to={() => ray2f_evaluate(ray().ray2, -1000)}
            stroke={colors.white}
            lineWidth={2}
            opacity={0.5}
            lineDash={[5,5]}
        />)
    }

    const apparentCircle = <Circle
        position={apparentPosition}
        size={20}
        stroke={"#ffaa00"}
        lineWidth={4}
    />
    view.add(apparentCircle)
}

export default makeScene2D(function* (view) {
    const curvature = createSignal<number>(0)
    const lens = <Layout
        position={[-300,200]}
    />
    const reflector = <Layout
        position={[+300,200]}
    />
    makeLens(lens, curvature)
    makeReflector(reflector, curvature)
    view.add(lens)
    view.add(reflector)

    yield* curvature(-1e-5, 0).to(-0.316, 2).to(-1e-5, 4)
});
