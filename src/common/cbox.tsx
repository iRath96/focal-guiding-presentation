import { PathVertex, PathVertexType, PathVisualizer } from '../ui/path'
import { Circle2f, Line2f, Ray2f, Vector2f, circle2f_intersect, circle2f_normal, line2f_intersect, line2f_normal, ray2f_evaluate, sample_hemicircle, vec2f, vec2f_add, vec2f_direction, vec2f_distance, vec2f_dot, vec2f_lerp, vec2f_minus, vec2f_multiply, vec2f_polar, vec2f_reflect } from '../rt/math'
import { Layout, Line, Node } from '@motion-canvas/2d'
import { Vector2, createSignal } from '@motion-canvas/core'
import { wiggle } from './animations'
import { colors, isSIGGRAPH } from '../common'

interface CBoxProps {
    onlyFloor: boolean
}

interface CBoxWall extends Line2f {
    mirror?: boolean
}

export function makeCBoxView() {
    return <Layout
        position={[
            isSIGGRAPH ? 0 : -350,
            55
        ]}
        scale={[ -1, 1 ]}
    />
}

export class CBox {
    public cameraNode: Node
    public lightNode: Node
    public pathvis: PathVisualizer

    public walls: CBoxWall[] = [
        // main box
        { from: vec2f(-300, 300), to: vec2f( 300, 300) },
        { from: vec2f( 300, 300), to: vec2f( 300,-300) },
        { from: vec2f( 300,-300), to: vec2f(-300,-300), mirror: true },

        // small box
        { from: vec2f(-90+150, 300), to: vec2f(-90+150, 120) },
        { from: vec2f(-90+150, 120), to: vec2f( 90+150, 120) },
        { from: vec2f( 90+150, 120), to: vec2f( 90+150, 300) },
    ]

    public light: Circle2f = {
        center: vec2f(0, -200),
        radius: 25
    }

    public camera: Circle2f = {
        center: vec2f(-500, 0),
        radius: 20
    }

    public cameraDir = 0
    public cameraSpread = 90

    get focalPoints() {
        return [
            this.camera.center,
            this.light.center,
            this.mirroredCamera.center,
            this.mirroredLight.center
        ]
    }

    get ceilingY() {
        return this.walls[1].to.y
    }

    mirrorAtCeiling(p: Vector2f) {
        return vec2f(p.x, 2 * this.ceilingY - p.y)
    }

    get mirroredCamera(): Circle2f {
        return {
            center: this.mirrorAtCeiling(this.camera.center),
            radius: this.camera.radius
        }
    }

    get mirroredLight(): Circle2f {
        return {
            center: this.mirrorAtCeiling(this.light.center),
            radius: this.light.radius
        }
    }

    constructor(
        private view: Node,
        props: Partial<CBoxProps> = {}
    ) {
        this.pathvis = new PathVisualizer(view)
        if (props.onlyFloor) {
            this.walls = [ this.walls[0] ]
        }
    }

    draw() {
        for (const wall of this.walls) {
            this.view.add(<Line
                points={[ wall.from, wall.to ]}
                stroke={colors.white}
                lineWidth={4}
            />)
        }

        this.cameraNode = this.pathvis.showCamera(this.camera, this.cameraDir)
        this.lightNode = this.pathvis.showLight(this.light)
    }

    *fadeInWalls() {
        for (const wall of this.walls) {
            const t = createSignal(0)
            this.view.add(<Line
                points={() => [ wall.from, vec2f_lerp(wall.from, wall.to, t()) ]}
                stroke={colors.white}
                lineWidth={4}
            />)
            yield* t(1, 0.2);
        }
    }

    *fadeInLight() {
        this.lightNode = this.pathvis.showLight(this.light)
        yield* wiggle(this.lightNode, 0.5, 0.5, 0)
    }

    *fadeInCamera() {
        this.cameraNode = this.pathvis.showCamera(this.camera, this.cameraDir)
        yield* wiggle(this.cameraNode, 0.5, 0.5, 0)
    }

    intersect(ray: Ray2f, ignoreCamera = true): PathVertex {
        let type = PathVertexType.Miss
        let p = ray2f_evaluate(ray, 2000)
        let n = vec2f_multiply(ray.d, -1)
        let minT = Infinity

        function consider(t: number) {
            if (t > 1 && t < minT) {
                minT = t
                p = ray2f_evaluate(ray, t)
                return true
            }
            return false
        }

        for (const wall of this.walls) {
            if (consider(line2f_intersect(wall, ray))) {
                n = line2f_normal(wall)
                type = wall.mirror ?
                    PathVertexType.Specular :    
                    PathVertexType.Diffuse
            }
        }

        if (consider(circle2f_intersect(this.light, ray))) {
            n = circle2f_normal(this.light, p)
            type = PathVertexType.Light
        }

        if (!ignoreCamera && consider(circle2f_intersect(this.camera, ray))) {
            n = circle2f_normal(this.camera, p)
            type = PathVertexType.Camera
        }

        if (vec2f_dot(n, ray.d) > 0) n = vec2f_minus(n)

        return { p, n, type }
    }

    pathtrace(
        nextFloat: () => number,
        opt: {
            useNEE?: boolean
            maxDepth?: number
        } = {}
    ): PathVertex[][] {
        opt = {
            useNEE: true,
            maxDepth: 10,
            ...opt
        }

        let ray: Ray2f = {
            o: this.camera.center,
            d: vec2f_polar(
                (this.cameraDir + this.cameraSpread * (nextFloat() - 0.5))
                * Math.PI / 180
            )
        }
        ray.o = ray2f_evaluate(ray, this.camera.radius)
        const path: PathVertex[] = [{
            p: ray.o,
            n: ray.d,
            type: PathVertexType.Camera,
        }]
        const paths: PathVertex[][] = []
        for (let depth = 1;; depth++) {
            const isect = this.intersect(ray)
            let isDone = (
                isect.type === PathVertexType.Miss ||
                isect.type === PathVertexType.Light)
            if (depth >= opt.maxDepth && !isDone) {
                isect.type = PathVertexType.Miss
                isDone = true
            }
            path.push(isect)
            if (isDone) {
                paths.push(path)
                break
            }

            if (opt.useNEE && isect.type !== PathVertexType.Specular) {
                const neeD = vec2f_direction(isect.p, this.light.center)
                const neeP = vec2f_add(
                    this.light.center,
                    vec2f_multiply(neeD, -this.light.radius)
                )
                const neeRay: Ray2f = {
                    o: isect.p,
                    d: neeD,
                }
                const neeIsect = this.intersect(neeRay)
                if (vec2f_distance(neeIsect.p, neeP) < 1) {
                    paths.push([
                        ...path,
                        { ...neeIsect, nee: true }
                    ])
                }
            }
            
            ray.o = isect.p
            if (isect.type === PathVertexType.Specular) {
                ray.d = vec2f_reflect(isect.n, vec2f_multiply(ray.d, -1))
            } else {
                ray.d = sample_hemicircle(isect.n, nextFloat())
            }
        }
        return paths
    }

    lighttrace(
        nextFloat: () => number,
        opt: {
            useNEE?: boolean
            maxDepth?: number
        } = {}
    ): PathVertex[][] {
        opt = {
            useNEE: true,
            maxDepth: 10,
            ...opt
        }

        let ray: Ray2f = {
            o: this.light.center,
            d: vec2f_polar(2 * Math.PI * nextFloat()),
        }
        ray.o = ray2f_evaluate(ray, this.light.radius)
        const path: PathVertex[] = [{
            p: ray.o,
            n: ray.d,
            type: PathVertexType.Light,
        }]
        const paths: PathVertex[][] = []
        for (let depth = 1;; depth++) {
            const isect = this.intersect(ray, false)
            let isDone = (
                isect.type === PathVertexType.Miss ||
                isect.type === PathVertexType.Camera)
            if (depth >= opt.maxDepth && !isDone) {
                isect.type = PathVertexType.Miss
                isDone = true
            }
            path.push(isect)
            if (isDone) {
                paths.push(path)
                break
            }

            if (opt.useNEE && isect.type !== PathVertexType.Specular) {
                const neeD = vec2f_direction(isect.p, this.camera.center)
                const neeP = vec2f_add(
                    this.camera.center,
                    vec2f_multiply(neeD, -this.camera.radius)
                )
                const neeRay: Ray2f = {
                    o: isect.p,
                    d: neeD,
                }
                const neeIsect = this.intersect(neeRay, false)
                if (vec2f_distance(neeIsect.p, neeP) < 1) {
                    paths.push([
                        ...path,
                        { ...neeIsect, nee: true }
                    ])
                }
            }
            
            ray.o = isect.p
            if (isect.type === PathVertexType.Specular) {
                ray.d = vec2f_reflect(isect.n, vec2f_multiply(ray.d, -1))
            } else {
                ray.d = sample_hemicircle(isect.n, nextFloat())
            }
        }
        return paths
    }
}
