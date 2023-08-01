import { Circle, Img, Layout, Node, Ray, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { Reference, all, chain, createRef, createSignal, sequence, waitFor, waitUntil } from "@motion-canvas/core";
import { Captions } from "../common/captions";
import { Line2f, line2f_evaluate, line2f_intersect, ray2f_evaluate, ray2f_targeting, vec2f } from "../rt/math";
import { colors } from "../common";
import { linspace } from "../common/guiding";

const captions = createRef<Captions>()

function* title(view: Node) {
    yield* captions().showTransition("Results", 1)
}

function* cameraObscura(originalView: Node) {
    yield* waitUntil('obscura')

    const view = <Layout/>;
    originalView.add(view);

    const showCropRect = createSignal(1);
    const reference = <Layout
        y={-170}
        scale={0.87}
    >
        <Img
            src={"imgs/camera-obscura/Reference.png"}
            size={[1280,720]}
            stroke={"#aaa"}
            lineWidth={8}
        />
        <Rect
            size={96}
            position={[880+48-640,370+48-360]}
            stroke={"red"}
            lineWidth={4}
            opacity={showCropRect}
            scale={showCropRect}
            zIndex={50}
        />
    </Layout>;
    view.add(reference);

    const renders = <Layout/>;
    view.add(renders);
    const methods = ["PT", "MEMLT", "MCVCM", "PAVMM", "Ours", "Reference"]
    const references = methods.reduce((h, k) => ({
        ...h,
        [k]: createRef<Layout>(),
    }), {} as {[k:string]: Reference<Layout>})
    yield* sequence(0.1, ...methods.map((method, i) => {
        const img = <Layout
            ref={references[method]}
            position={[ (i - 2.5) * 290, 320 ]}
            opacity={0}
        >
            <Img
                src={`imgs/camera-obscura/${method}_crop.png`}
                size={[240,240]}
                stroke={"#aaa"}
                lineWidth={8}
            />
            <Txt
                text={method}
                y={165}
                fontSize={40}
                fill={"#fff"}
            />
        </Layout>;
        renders.add(img)
        return img.opacity(1, 1)
    }))

    function* highlight(method: string) {
        yield* waitUntil(`obs/${method}`);

        const ref = references[method]();
        const y = ref.y();
        ref.zIndex(10);
        yield* all(
            ref.scale(1.5, 1),
            ref.y(y - 50, 1),
        );
        yield* waitFor(1);
        yield* all(
            ref.scale(1, 1),
            ref.y(y, 1),
        );
        ref.zIndex(0);
    }

    yield* highlight('MCVCM')
    yield* highlight('Ours')

    // show sample rays
    const focalPoint = vec2f(0, 0);
    const focal = <Circle
        position={focalPoint}
        size={20}
        fill={colors.red}
        lineWidth={2}
        stroke={"#fff"}
        zIndex={20}
        opacity={0}
        scale={10}
    />;
    reference.add(focal);
    yield* all(
        focal.opacity(1, 1),
        focal.scale(1, 1),
    );

    const startLine: Line2f = {
        from: vec2f(-390, -140),
        to: vec2f(-330, 120),
    }
    const endLine: Line2f = {
        from: vec2f(370, -200),
        to: vec2f(230, 200),
    }
    const fadeIn = createSignal(0)
    for (const t of linspace(10)) {
        const ray = ray2f_targeting(
            line2f_evaluate(startLine, t),
            focalPoint
        );
        const hit = line2f_intersect(endLine, ray);
        if (!isFinite(hit)) continue;
        reference.add(<Ray
            from={ray.o}
            to={() => ray2f_evaluate(ray, fadeIn() * hit)}
            lineWidth={4}
            stroke={colors.yellow}
            arrowSize={12}
            endArrow
        />)
    }
    yield* fadeIn(1, 2)

    yield* waitUntil('obs/done')
    yield* view.opacity(0, 1)
    view.remove()
}

export default makeScene2D(function* (view) {
    view.add(<Captions
        ref={captions}
        chapter="Results"
        blocker={false}
    />);

    yield* title(view)
    yield* cameraObscura(view)

    yield* waitUntil('done')
});
