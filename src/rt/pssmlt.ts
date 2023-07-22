import { Random } from '@motion-canvas/core'

export class PSSMLT {
    private prng = new Random(123)
    public stepSize = 0.1
    private rnd: {
        v: number // base
        m: number // mutated
        a: boolean
    }[] = []
    private index = 0

    nextFloat() {
        if (this.index >= this.rnd.length) {
            const m = this.prng.nextFloat()
            this.rnd.push({ v: 0, m, a: false })
            return m
        }

        const r = this.rnd[this.index++]
        if (r.a) {
            r.m = r.v + this.stepSize * (2 * this.prng.nextFloat() - 1)
            if (r.m > 1) r.m -= 1
            if (r.m < 0) r.m += 1
        } else {
            r.m = this.prng.nextFloat()
        }
        return r.m
    }

    seed(rnd: number[]) {
        this.rnd = rnd.map(v => ({ v, m: v, a: true }))
    }

    accept() {
        for (const r of this.rnd) {
            r.v = r.m
            r.a = true
        }
        this.index = 0
    }

    reject() {
        this.index = 0
    }

    randomAccept() {
        return this.prng.nextFloat() > 0.5
    }
}
