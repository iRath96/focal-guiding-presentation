import { Node, Img, Layout, Rect, Txt, makeScene2D, LineProps, Ray } from "@motion-canvas/2d";
import { Random, all, chain, createRef, createSignal, debug, sequence, waitUntil } from "@motion-canvas/core";
import { Captions } from "../common/captions";
import { CBox } from "../common/cbox";
import { findGuidePaths } from "../common/guiding";
import { PathVertex, PathVertexType, PathVisualizer, path_segments, shuffle } from "../ui/path";
import { Bounds2f, bounds2f_center, bounds2f_diagonal, ray2f_evaluate, ray2f_targeting, vec2f, vec2f_direction, vec2f_lerp, vec2f_multiply, vec2f_pmultiply, vec2f_sub } from "../rt/math";
import { colors } from "../common";

const captions = createRef<Captions>()

function* cameraObscura(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    const showCropRect = createSignal(0);
    const highlight = createRef<Rect>();
    const reference = <Layout>
        <Rect
            ref={highlight}
            stroke={"#fff"}
            lineWidth={8}
            radius={20}
            opacity={0}
            zIndex={10}
        />
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
    view.add(reference);

    reference.scale(0.8)
    reference.opacity(0)
    yield* all(
        reference.scale(1, 5),
        reference.opacity(1, 5),
    );
    
    function* showHighlight(name: string, bounds: Bounds2f, time = 1) {
        const htime = name === 'left' ? 0 : time;
        yield* waitUntil(`h/${name}`);
        yield* all(
            highlight().opacity(1, time),
            highlight().position(
                vec2f_sub(
                    bounds2f_center(bounds),
                    vec2f(640, 360)
                )
            , htime),
            highlight().size(bounds2f_diagonal(bounds), htime)
        )
    }

    yield* showHighlight('left', { min: vec2f(30, 30), max: vec2f(570, 690) })
    yield* showHighlight('right', { min: vec2f(670, 30), max: vec2f(1250, 690) })
    yield* showHighlight('pinhole', { min: vec2f(580, 320), max: vec2f(660, 400) })
    yield* showHighlight('canvas', { min: vec2f(830, 200), max: vec2f(1100, 520) })
    yield* waitUntil('h/end');
    yield* highlight().opacity(0, 1);
    
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

function* title(originalView: Node) {
    const view = <Layout/>;
    originalView.add(view);

    const title = createSignal("")
    const authors = [
        { name: "Alexander Rath", affiliations: [1,2,3], },
        { name: "Ömercan Yazici", affiliations: [2,3], },
        { name: "Philipp Slusallek", affiliations: [2,3], },
    ]
    const affiliations = [
        {
            symbol: "1",
            name: "Intel Corporation",
            image: "intel", aspect: 2.4, scale: 0.75 },
        {
            symbol: "2",
            name: "Saarland University",
            image: "uds", aspect: 2.5, scale: 1.0 },
        {
            symbol: "3",
            name: "DFKI GmbH.",
            image: "dfki", aspect: 2.5, scale: 0.75 },
    ]
    const logoHeight = 100
    view.add(<Layout layout direction={"column"} width={1800}>
        <Txt
            text={title}
            height={100}
            fill={colors.white}
            fontSize={80}
        />
        <Layout direction={"row"} marginTop={30}>
            {authors.map(author => <Layout marginRight={40}>
                <Txt
                    text={author.name}
                    fill={colors.white}
                    marginRight={10}
                />
                <Txt
                    text={author.affiliations.join(", ")}
                    fill={colors.white}
                    fontSize={30}
                />
            </Layout>)}
        </Layout>
        <Layout direction={"row"} marginTop={30} fontSize={40}>
            {affiliations.map(affiliation => <Layout marginRight={40}>
                <Txt
                    text={affiliation.symbol}
                    fill={colors.white}
                    opacity={0.7}
                    marginRight={10}
                    fontSize={20}
                />
                <Layout direction={"column"} alignItems={"center"}>
                    <Txt
                        text={affiliation.name}
                        fill={colors.white}
                        opacity={0.7}
                    />
                    <Img
                        marginTop={15}
                        scale={affiliation.scale}
                        src={`logos/${affiliation.image}.svg`}
                        size={[logoHeight * affiliation.aspect, logoHeight]}
                    />
                </Layout>
            </Layout>)}
        </Layout>
    </Layout>)
    yield* title("Focal Path Guiding", 1);

    yield* waitUntil('title/done')
    yield* view.opacity(0, 1);
    view.remove();
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

    const cboxView = <Layout
        position={[-350, 55]}
        scale={[ -1, 1 ]}
    />;
    const pathvisView = <Layout />;
    const cboxGeomView = <Layout />;
    cboxView.add(pathvisView);
    cboxView.add(cboxGeomView);
    view.add(cboxView);
    const cbox = new CBox(cboxGeomView);
    const pathvis = new PathVisualizer(pathvisView);
    
    yield* waitUntil('geometry')
    yield* cbox.fadeInWalls()

    yield* waitUntil('materials')
    const matview = <Layout />;
    cboxView.add(matview);
    const materials = [
        { name: "mirror", anchor: vec2f(0, -300) },
        { name: "paint", anchor: vec2f(300, 0) },
        { name: "tiles", anchor: vec2f(0, 300) },
    ]
    yield* chain(...materials.map(material => {
        const offset = vec2f_multiply(material.anchor, 0.3);
        const mat = <Layout opacity={0} position={material.anchor}>
            <Img
                position={offset}
                src={`imgs/materials/${material.name}.png`}
                size={[181, 194]}
                scale={[-0.7,0.7]}
                stroke={"#000"}
                lineWidth={10}
            />
            {/*<Txt
                text={material.name}
                fill={"#fff"}
                fontSize={30}
                y={50}
            />*/}
        </Layout>;
        matview.add(mat);
        mat.scale(0.1)
        return all(
            mat.opacity(1, 0.5),
            mat.scale(1, 0.5),
        );
    }))

    yield* waitUntil('lights')
    yield* cbox.fadeInLight()

    yield* waitUntil('camera')
    yield* cbox.fadeInCamera()

    const referenceImage = <Img
        size={[1024,1024]}
        src={"imgs/cbox.png"}
        opacity={0}
    />;
    view.add(referenceImage);
    yield* all(
        referenceImage.opacity(1, 1).wait(4).to(0, 1),
        matview.opacity(0, 1),
    );
    matview.remove();

    yield* waitUntil('paths')
    const paths = findGuidePaths(cbox, {
        spread: 110,
        dir: 0,
        maxDepth: 6,
        seed: 9,
        candidates: 700,
        yBlock: false,
    }).filter((path, i) => {
        if (path.length === 2 || (path.length === 3 && path[1].type === PathVertexType.Specular)) {
            return i % 3 === 0;
        }
        return true;
    }).map(path =>
        path.map(vertex => {
            if (vertex.type === PathVertexType.Camera) {
                return { ...vertex, p: cbox.camera.center }
            }
            if (vertex.type === PathVertexType.Light) {
                return { ...vertex, p: cbox.light.center }
            }
            return vertex
        })
    );
    shuffle(paths)
    yield* sequence(0.05, ...paths.map(path => {
        const id = pathvis.showPath(path, { opacity: 0.5 });
        return pathvis.fadeInPath(id, 1);
    }))
    
    // draw extensions
    yield* waitUntil('extensions')
    yield* all(
        cboxGeomView.opacity(0.2, 1),
        pathvis.opacity(0.5, 1),
    );
    const extIds: number[] = []
    const extProps: LineProps = {
        lineDash: [2,6],
        opacity: 0.3,
    }
    for (const path of paths) {
        let prevP: PathVertex
        for (const [a,b] of path_segments(path)) {
            //if (a.type === PathVertexType.Camera) {
            //    extIds.push(pathvis.showPath([
            //        a,
            //        { p: ray2f_evaluate(ray2f_targeting(a.p, b.p), -150) }
            //    ], extProps))
            //}
            if (a.type === PathVertexType.Specular && b.type === PathVertexType.Light) {
                //extIds.push(pathvis.showPath([
                //    b,
                //    { p: ray2f_evaluate(ray2f_targeting(b.p, a.p), -150) }
                //], extProps))
                extIds.push(pathvis.showPath([
                    a,
                    { p: ray2f_evaluate(ray2f_targeting(a.p, cbox.mirroredLight.center), 400) }
                ], extProps))
            }
            if (a.type === PathVertexType.Specular && prevP.type === PathVertexType.Camera) {
                extIds.push(pathvis.showPath([
                    a,
                    { p: ray2f_evaluate(ray2f_targeting(a.p, cbox.mirroredCamera.center), 800) }
                ], extProps))
            }
            prevP = a
        }
    }
    yield* sequence(0.05, ...extIds.map(ext => {
        return pathvis.fadeInPath(ext, 1);
    }))

    // highlight focal points
    yield* waitUntil('focal');
    const prevCboxY = cboxView.y();
    yield* cboxView.y(200, 1);
    yield* sequence(0.2, ...cbox.focalPoints.map(focal => {
        const rect = <Rect
            position={focal}
            size={90}
            stroke={colors.green}
            lineWidth={8}
            opacity={0}
            radius={5}
        />;
        pathvisView.add(rect);
        rect.scale(0.1);
        return all(
            rect.opacity(1, 1),
            rect.scale(1, 1),
        );
    }));

    yield* waitUntil('intro/done')
    yield* all(
        cboxGeomView.opacity(1, 1),
        pathvisView.opacity(0, 1),
        cbox.cameraNode.rotation(34.4, 1),
        captions().chapter("", 1),
        cboxView.y(prevCboxY, 1),
    );
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
});
