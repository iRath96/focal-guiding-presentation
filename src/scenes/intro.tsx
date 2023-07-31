import { Node, Img, Layout, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { all, chain, createRef, createSignal, waitUntil } from "@motion-canvas/core";
import { Captions } from "../common/captions";

const captions = createRef<Captions>()

function* cameraObscura(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    const showCropRect = createSignal(0)
    const reference = <Layout>
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
        />
    </Layout>;
    view.add(reference)

    reference.scale(0.8)
    reference.opacity(0)
    yield* all(
        reference.scale(1, 5),
        reference.opacity(1, 5),
    );
    
    yield* waitUntil('show crops')
    yield* all(
        showCropRect(1, 1),
        reference.y(-170, 1),
        reference.scale(0.87, 1)
    );
    const renders = <Layout/>;
    view.add(renders);
    const methods = ["PT", "MEMLT", "MCVCM", "PAVMM", "Ours"]//, "Reference"]
    yield* chain(...methods.map((method, i) => {
        const img = <Layout
            position={[ (i - 1.5) * 290, 320 ]}
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

        const isOurs = method === "Ours"
        const task = all(
            img.opacity(1, 1),
            renders.x(isOurs ? -290/2 : 0, 1),
        )
        if (isOurs) return chain(waitUntil('ours'), task)
        return task
    }))

    yield* waitUntil('title')
    yield* view.opacity(0, 1)
    view.remove()
}

function* title(view: Node) {
    yield* captions().showTransition("Focal Path Guiding", 1)
}

function* agenda(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    yield* captions().chapter("Agenda", 1)

    const points = [
        "Background",
        "Focal Points",
        "Previous Work",
        "Our Approach",
        "Results",
        "",
    ]
    let prevT: Node = <Txt />
    yield* chain(...points.map((point, index) => {
        const t = <Txt
            width={1700}
            y={(index - 2) * 100}
            text={point}
            fontSize={50}
            fill={"#fff"}
            opacity={0}
        />
        view.add(t)
        const task = chain(
            waitUntil(`agenda/${index}`),
            all(
                prevT.opacity(0.5, 1),
                prevT.x(0, 1),
                //prevT.y(prevT.y() - 10, 1),
                //prevT.scale(1, 1),
                //t.scale(1.2, 1),
                t.opacity(1, 1),
                t.x(20, 1),
            )
        )
        prevT = t
        return task
    }))

    yield* waitUntil('lts')
    yield* all(
        view.opacity(0, 1),
        captions().chapter("", 1),
    )
    view.remove()
}

function* lts(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    yield* captions().chapter("Background", 1);

    // TODO
}

export default makeScene2D(function* (view) {
    view.add(<Captions
        ref={captions}
        chapter=""
        blocker={false}
    />);

    yield* cameraObscura(view)
    yield* title(view)
    yield* agenda(view)
    yield* lts(view)

    yield* waitUntil('intro/done')
});
