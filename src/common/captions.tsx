import { Circle, Gradient, Node, NodeProps, Rect, Txt, initial, signal } from '@motion-canvas/2d'
import { SimpleSignal, all, createRef, delay, waitFor } from '@motion-canvas/core'
import { colors } from '../common';

export interface CaptionsProps extends NodeProps {
    chapter?: SimpleSignal<string> | string
    blocker?: boolean
}

export class Captions extends Node {
    @initial("") @signal()
    public declare readonly chapter: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly title: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly references: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly transitionText: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly transitionOpacity: SimpleSignal<number, this>;

    private refText = createRef<Txt>()
    private refTextY = {
        shown: 500,
        hidden: 580,
    }

    public constructor(props?: CaptionsProps) {
        super({
            zIndex: 100,
            ...props,
        })

        this.add(<Rect
            size={[1920,1080]}
            opacity={this.transitionOpacity}
            fill={colors.background}
            zIndex={10}
        >
            <Txt
                text={this.transitionText}
                position={[0,0]}
                width={1920-240}
                fill={colors.white}
                fontSize={80}
            />
        </Rect>)

        this.add(<Txt
            text={this.chapter}
            fill={"#fff"}
            position={[0, -480]}
            width={1850}
            fontSize={30}
            opacity={0.5}
        />)

        this.add(<Txt
            text={this.title}
            fill={"#fff"}
            position={[0, -430]}
            width={1850}
        />)

        this.add(<Txt
            ref={this.refText}
            text={this.references}
            fill={"#fff"}
            position={[0, 580]}
            width={1850}
            opacity={0.4}
            fontSize={30}
            fontStyle={"italic"}
        />)

        if ({ blocker: true, ...props }.blocker) {
            this.add(<Rect
                size={[1920, 1080]}
                fill={new Gradient({
                    from: [-970, 0],
                    to: [970, 0],
                    stops: [
                        { color: "rgba(0,0,0,0)", offset: 0.6, },
                        { color: "black", offset: 0.75, },
                    ],
                })}
                zIndex={1}
            />)
        }
    }

    *showTransition(text: string, time: number) {
        this.transitionOpacity(1)
        this.transitionText("")
        yield* this.transitionText(text, 2)
        yield* waitFor(time)
        yield* all(
            this.transitionText("", 2),
            delay(1, this.transitionOpacity(0, 1)),
        )
    }

    *reset() {
        yield* all(
            this.updateTitle(),
            this.updateReference(),
        )
    }

    *updateTitle(title?: string) {
        yield* this.title(title || "", 1)
    }

    *updateReference(ref?: string) {
        if (this.refText().y() === this.refTextY.shown) {
            yield* this.refText().y(this.refTextY.hidden, 0.7)
        }
        this.references(ref)
        if (ref) {
            yield* this.refText().y(this.refTextY.shown, 0.7)
        }
    }
}
