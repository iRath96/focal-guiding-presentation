import { Gradient, Node, NodeProps, Rect, Txt, initial, signal } from '@motion-canvas/2d'
import { SimpleSignal, createRef } from '@motion-canvas/core'

export interface CaptionsProps extends NodeProps {
    chapter?: SimpleSignal<string> | string
}

export class Captions extends Node {
    @initial("") @signal()
    public declare readonly chapter: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly title: SimpleSignal<string, this>;

    @initial("") @signal()
    private declare readonly references: SimpleSignal<string, this>;

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
