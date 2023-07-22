import { Node, NodeProps, Rect, Txt, initial, signal } from '@motion-canvas/2d'
import { SimpleSignal } from '@motion-canvas/core'

export interface CaptionsProps extends NodeProps {
    chapter?: SimpleSignal<string> | string
}

export class Captions extends Node {
    @initial("") @signal()
    public declare readonly chapter: SimpleSignal<string, this>;

    @initial("") @signal()
    public declare readonly title: SimpleSignal<string, this>;

    public constructor(props?: CaptionsProps) {
        super({
            ...props
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
    }
}
