import { Path, PathVertexType } from '../ui/path'
import { Vector2f, vec2f_direction, vec2f_dot, vec2f_polar } from '../rt/math'
import { CBox } from './cbox'
import { Random, SignalValue, SimpleSignal, debug } from '@motion-canvas/core'
import { Node, NodeProps, Rect, initial, signal } from '@motion-canvas/2d'
import { colors } from '../common'

export interface FocalHighlightProps extends NodeProps {
    position: SignalValue<Vector2f>
}

export class FocalHighlight extends Node {
    @initial(0) @signal()
    public declare readonly opacity: SimpleSignal<number, this>;

    constructor(props: FocalHighlightProps) {
        super(props);
        debug(props.position)
        this.add(<Rect
            size={90}
            stroke={colors.green}
            lineWidth={8}
            opacity={this.opacity}
            scale={() => this.opacity() * 0.9 + 0.1}
            radius={5}
        />);
    }
}

export class StratifiedRandom {
    private dim = 0
    private index = -1
    constructor(
        public prng: Random,
        public count: number
    ) {}

    start() {
        this.dim = 0
        this.index++
    }

    nextFloat() {
        if (this.dim++ == 0) {
            return this.index / (this.count - 1)
        }
        return this.prng.nextFloat()
    }
}

interface Rnd {
    nextFloat(): number
}

export class FakeRandom {
    private dim = 0
    constructor(
        public initial: number[],
        public prng: Rnd = new Random(1234),
    ) {}

    restart() {
        this.dim = 0
    }

    nextFloat() {
        if (this.dim < this.initial.length) {
            return this.initial[this.dim++]
        }
        return this.prng.nextFloat()
    }
}

export interface FindPathProps {
    dir: number
    spread: number
    candidates: number
    seed: number
    maxDepth: number
    yBlock: boolean
}

export function findGuidePaths(cbox: CBox, props: Partial<FindPathProps> = {}) {
    const $: FindPathProps = {
        spread: 0,
        candidates: 1000,
        seed: 1234,
        dir: -4.5,
        maxDepth: 3,
        yBlock: true,
        ...props
    };
    const prevCameraSpread = cbox.cameraSpread
    const prevCameraDir = cbox.cameraDir
    cbox.cameraSpread = $.spread
    cbox.cameraDir = $.dir

    const paths: Path[] = []
    const prng = new StratifiedRandom(new Random($.seed), $.candidates)
    for (let i = 0; i < $.candidates; i++) {
        prng.start()
        const path = cbox.pathtrace(() =>
            prng.nextFloat(), {
                useNEE: false,
                maxDepth: $.maxDepth,
            }
        )[0]
        if (path[path.length - 1].type !== PathVertexType.Light) continue
        
        const cosLight = -vec2f_dot(
            vec2f_direction(path[path.length-2].p, path[path.length-1].p),
            path[path.length-1].n
        )
        if (cosLight < 0.9) continue
        if ($.yBlock) {
            //if (path[1].type !== PathVertexType.Diffuse) continue
            if (path[1].type === PathVertexType.Light) continue
            if (path[1].p.y > 100) continue
        }
        
        paths.push(path)
    }

    cbox.cameraSpread = prevCameraSpread
    cbox.cameraDir = prevCameraDir
    return paths
}

export function saturate(v: number) {
    return Math.max(0, Math.min(1, v))
}

export function theta_linspace(i: number, n: number) {
    return 2 * Math.PI * ((i + 0.5) / n)
}

export function sample(radii: number[], rng: number[]) {
    // normalize
    const sum = radii.reduce((sum, r) => sum + r, 0)
    radii = radii.map(r => r / sum)

    return rng.map(u => {
        for (let i = 0; i < radii.length; i++) {
            if (u < radii[i]) {
                u /= radii[i]
                return i + u
            }
            u -= radii[i]
        }
        return 0
    })
}

export function polar_plot(radii: number[], scale: number) {
    let points: Vector2f[] = []
    for (let i = 0; i <= radii.length; i++) {
        const theta = theta_linspace(i, radii.length)
        const radius = Math.sqrt(radii[i % radii.length])
        points.push(vec2f_polar(theta, scale * radius))
    }

    return points
}

export function linspace(n: number) {
    const v: number[] = []
    for (let i = 0; i < n; i++) {
        v.push((i + 0.5) / n)
    }
    return v
}

export function linear_lookup(v: number[], i: number) {
    const iInt = Math.floor(i)
    const iFrac = i - iInt
    return (1 - iFrac) * v[iInt % v.length] + iFrac * v[(iInt + 1) % v.length]
}
