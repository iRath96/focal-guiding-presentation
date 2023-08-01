import { Circle, Img, Layout, Node, Ray, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { Reference, Vector2, all, chain, createRef, createSignal, sequence, waitFor, waitUntil } from "@motion-canvas/core";
import { Captions } from "../common/captions";
import { Bounds2f, Line2f, Vector2f, line2f_evaluate, line2f_intersect, ray2f_evaluate, ray2f_targeting, vec2f } from "../rt/math";
import { colors } from "../common";
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
            stroke={"red"}
            lineWidth={4}
            opacity={showCropRect}
            scale={showCropRect}
            zIndex={50}
        />
    </Layout>;
    view.add(reference);
    yield* reference.opacity(1, 1);

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
                src={`imgs/${$.path}/${method}_crop.png`}
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
                stroke={"#fff"}
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

    const lineHeight = 80
    const pointGap = 50
    let currentY = -300
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
    const view = <Layout/>;
    originalView.add(view);

    view.add(<Txt
        text={"Thank you"}
        fill={colors.white}
    />)
}

export default makeScene2D(function* (view) {
    view.add(<Captions
        ref={captions}
        chapter="Results"
        blocker={false}
    />);

    yield* title(view)
    yield* cameraObscura(view)
    yield* diningRoom(view)
    yield* livingRoom(view)

    yield* waitUntil('summary')
    yield* captions().chapter("", 1)
    yield* captions().chapter("Summary", 1)
    yield* summary(view);

    yield* captions().chapter("Acknowledgements", 1);
    yield* acknowledgements(view);

    yield* waitUntil('done');
});
