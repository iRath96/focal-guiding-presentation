import { Circle, Img, Layout, Node, Ray, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { Reference, Vector2, all, chain, createRef, createSignal, sequence, waitFor, waitUntil } from "@motion-canvas/core";
import { Captions } from "../common/captions";
import { Bounds2f, Line2f, Vector2f, line2f_evaluate, line2f_intersect, ray2f_evaluate, ray2f_targeting, vec2f } from "../rt/math";
import { colors, isSIGGRAPH } from "../common";
import { linspace } from "../common/guiding";

const captions = createRef<Captions>()

function* title(view: Node) {
    yield* captions().showTransition("Results", 1)
}

interface ShowSceneProps {
    name: string
    path: string
    crop: Vector2f
    highlights: string[][]
    highlightsB: string[][]
    focalPoints: {
        point: Vector2f
        startLine: Line2f
        endLine: Line2f
    }[]
}

function* showScene(originalView: Node, $: ShowSceneProps) {
    yield* waitUntil($.name)

    const view = <Layout/>;
    originalView.add(view);

    const showCropRect = createSignal(1);
    const reference = <Layout
        y={-170}
        scale={0.87}
        opacity={0}
    >
        <Img
            src={`imgs/${$.path}/Reference.png`}
            size={[1280,720]}
            stroke={"#aaa"}
            lineWidth={8}
        />
        <Rect
            size={96}
            position={[$.crop.x+48-640,$.crop.y+48-360]}
            stroke={colors.red}
            lineWidth={5}
            opacity={showCropRect}
            scale={showCropRect}
            zIndex={50}
            radius={6}
        />
    </Layout>;
    view.add(reference);
    yield* reference.opacity(1, 1);

    const renders = <Layout/>;
    view.add(renders);
    const methods = ["PT", "PAVMM", "Ours", "MEMLT", "MCVCM", "Reference"]
    const labels = [
        {
            name: "path tracing",
            from: 0,
            to: 2,
        }, {
            name: "bi-directional",
            from: 3,
            to: 4,
        }
    ]
    const cropSize = 200
    const cropMargin = 40
    const cropStride = cropSize + cropMargin
    const references = methods.reduce((h, k) => ({
        ...h,
        [k]: createRef<Layout>(),
    }), {} as {[k:string]: Reference<Layout>})
    yield* sequence(0.1, ...methods.map((method, i) => {
        const img = <Layout
            ref={references[method]}
            position={[ (i - 2.5) * cropStride, 360 ]}
            opacity={0}
        >
            <Img
                src={`imgs/${$.path}/${method}_crop.png`}
                size={[cropSize,cropSize]}
                stroke={"#aaa"}
                lineWidth={8}
            />
            <Txt
                text={method}
                y={cropSize/2 + 45}
                fontSize={37}
                letterSpacing={1}
                fill={colors.white}
                fontFamily={"Mukta"}
                fontWeight={300}
            />
        </Layout>;
        renders.add(img)
        return img.opacity(1, 1)
    }, ...labels.map(label => {
        const mid = (label.to - label.from) / 2 * cropStride
        const textWidth = label.name.length * 21
        const text = <Layout
            position={[ (label.from - 2.5) * cropStride, 215 ]}
            zIndex={-1}
            opacity={0.7}
        >
            <Ray
                fromX={-cropStride * 0.4}
                toX={mid - textWidth / 2}
                stroke={colors.white}
                lineWidth={1}
            />
            <Txt
                x={mid}
                y={4}
                text={label.name.toUpperCase()}
                fill={colors.white}
                fontFamily={"Mukta"}
                fontWeight={200}
                opacity={2}
                fontSize={30}
                letterSpacing={4}
            />
            <Ray
                fromX={cropStride * (label.to - label.from + 0.4)}
                toX={mid + textWidth / 2}
                stroke={colors.white}
                lineWidth={1}
            />
        </Layout>
        renders.add(text)
        return text.opacity(0.5, 1)
    })))

    function* highlights(phase: string, highlights: string[][]) {
        yield* chain(...highlights.map((highlight, hIndex) => {
            return chain(
                waitUntil(`${$.name}/${phase}${hIndex}`),
                all(...highlight.map(function* (method) {
                    const ref = references[method]();
                    const y = ref.y();
                    ref.zIndex(10);
                    yield* all(
                        ref.scale(1.2, 1),
                        ref.y(y - 24, 1),
                    );
                    yield* waitFor(1);
                    yield* all(
                        ref.scale(1, 1),
                        ref.y(y, 1),
                    );
                    ref.zIndex(0);
                }))
            );
        }))
    }

    yield* highlights('', $.highlights)

    // show sample rays
    yield* waitUntil(`${$.name}/focal`);
    yield* all(
        ...$.focalPoints.map(focal => {
            const circle = <Circle
                position={focal.point}
                size={20}
                fill={colors.red}
                lineWidth={2}
                stroke={colors.white}
                zIndex={20}
                opacity={0}
                scale={10}
            />;
            reference.add(circle);
            return all(
                circle.opacity(1, 1),
                circle.scale(1, 1),
            );
        })
    );

    yield* all(
        ...$.focalPoints.map(focal => {
            const fadeIn = createSignal(0)
            for (const t of linspace(10)) {
                const ray = ray2f_targeting(
                    line2f_evaluate(focal.startLine, t),
                    focal.point
                );
                const hit = line2f_intersect(focal.endLine, ray);
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
            return fadeIn(1, 2)
        })
    );

    yield* highlights('b-', $.highlightsB)

    yield* waitUntil(`${$.name}/done`)
    yield* view.opacity(0, 1)
    view.remove()
}

function* cameraObscura(originalView: Node) {
    yield* showScene(originalView, {
        name: 'obs',
        path: 'camera-obscura',
        highlights: [['MCVCM', 'MEMLT'], ['Ours']],
        highlightsB: [],
        crop: vec2f(880, 370),
        focalPoints: [{
            point: vec2f(0, 0),
            startLine: {
                from: vec2f(-390, -140),
                to: vec2f(-330, 120),
            },
            endLine: {
                from: vec2f(370, -200),
                to: vec2f(230, 200),
            }
        }]
    })
}

function* diningRoom(originalView: Node) {
    yield* showScene(originalView, {
        name: 'dr',
        path: 'dining-room',
        highlights: [],
        highlightsB: [['MCVCM', 'MEMLT'], ['MEMLT'], ['MCVCM'], ['Ours'], ['PAVMM']],
        crop: vec2f(610, 375),
        focalPoints: [{
            point: vec2f(-169, -80),
            startLine: {
                from: vec2f(-219, -155),
                to: vec2f(-119, -155),
            },
            endLine: {
                from: vec2f(-400, 110),
                to: vec2f(400, 110),
            }
        }, {
            point: vec2f(134, -80),
            startLine: {
                from: vec2f(84, -155),
                to: vec2f(184, -155),
            },
            endLine: {
                from: vec2f(-400, 110),
                to: vec2f(400, 110),
            }
        }]
    })
}

function* livingRoom(originalView: Node) {
    yield* showScene(originalView, {
        name: 'lr',
        path: 'modern-living-room',
        highlights: [['Ours']],
        highlightsB: [],
        crop: vec2f(617, 53),
        focalPoints: []
    })
}

function* summary(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    const points = [
        [
            "Defined and categorized focal points and",
            "investigated their common causes",
        ],
        [
            "Different families of rendering algorithms",
            "explore different kinds of focal points",
        ],
        [
            "Introduced you to our Focal Path Guiding",
            "and looked at some of its results",
        ],
    ]

    const lineHeight = 70
    const pointGap = 50
    let currentY = -265
    let prevNode = <Layout/>;
    yield* chain(...points.map((lines, index) => {
        const text = <Layout
            x={40}
            opacity={0}
        >
            <Circle
                x={-900}
                y={currentY + lineHeight - 7}
                size={10}
                fill={colors.white}
            />
            {lines.map((line, lineIndex) =>
                <Txt
                    y={currentY += lineHeight}
                    width={1700}
                    text={line}
                    fill={colors.white}
                    fontFamily={"Mukta"}
                    fontWeight={300}
                />
            )}
        </Layout>;
        currentY += pointGap
        view.add(text);
        const task = chain(
            waitUntil(`summary/${index}`),
            all(
                prevNode.opacity(0.5, 1),
                text.opacity(1, 1),
            ),
        );
        prevNode = text;
        return task;
    }));

    yield* waitUntil('summary/done');
    yield* all(
        captions().chapter("", 1),
        view.opacity(0, 1),
    );
    view.remove()
}

function* acknowledgements(originalView: Node) {
    const view = <Layout opacity={0} />;
    originalView.add(view);

    const thanks = [
        "My great co-authors",
        "Our anonymous reviewers",
        "Our test scene artists",
    ]
    const affiliations = [
        { image: "intel", aspect: 2.4, scale: 0.75 },
        { image: "uds", aspect: 2.5, scale: 1.0 },
        { image: "dfki", aspect: 2.5, scale: 0.75 },
    ]
    const logoHeight = 100
    view.add(<Layout
        layout
        direction={"column"}
        width={1800}
        fontFamily={"Mukta"}
        fontWeight={300}
    >
        <Txt
            text={"Thank you:"}
            height={130}
            fill={colors.white}
            fontSize={100}
            fontFamily={"Cormorant Garamond"}
            fontWeight={600}
        />
        {thanks.map(thank => <Txt
            marginTop={20}
            marginLeft={20}
            text={`•   ${thank}`}
            fontSize={50}
            fill={colors.white}
        />)}
        <Layout
            direction={"row"}
            marginTop={40}
            marginLeft={20}
            fontWeight={200}
            fontSize={40}
        >
            <Txt
                text="Animated using"
                fill={colors.white}
            />
            <Img
                src={"logos/motioncanvas.svg"}
                marginLeft={15}
                marginRight={5}
                marginTop={-6}
                size={50} />
            <Txt text="Motion Canvas" fill={colors.white} />
        </Layout>
        <Layout direction={"row"} marginTop={30} fontSize={40}>
            {affiliations.map(affiliation => <Layout marginRight={40}>
                <Img
                    marginTop={15}
                    scale={affiliation.scale}
                    src={`logos/${affiliation.image}.svg`}
                    size={[logoHeight * affiliation.aspect, logoHeight]}
                />
            </Layout>)}
        </Layout>
    </Layout>)

    yield* view.opacity(1, 1);
}

export default makeScene2D(function* (view) {
    view.add(<Captions
        ref={captions}
        chapter=""
        blocker={false}
    />);

    yield* title(view)
    if (isSIGGRAPH) {
        yield* captions().chapter("Results", 1)
    }
    const resultsView = <Layout x={
        isSIGGRAPH ? 0 : -200
    }/>
    view.add(resultsView)
    yield* cameraObscura(resultsView)
    yield* diningRoom(resultsView)
    yield* livingRoom(resultsView)

    yield* waitUntil('summary')
    yield* captions().chapter("", 1)
    yield* captions().chapter("Summary", 1)
    yield* summary(view);

    yield* captions().chapter("Acknowledgements", 1);
    yield* acknowledgements(view);

    yield* waitUntil('done');
});
