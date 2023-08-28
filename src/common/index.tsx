export function alpha(color: string, alpha: Number) {
    if (color.startsWith("#")) {
        if (color.length === 4) {
            const rgba = [
                Number.parseInt(color.slice(1, 2), 16) * 16,
                Number.parseInt(color.slice(2, 3), 16) * 16,
                Number.parseInt(color.slice(3, 4), 16) * 16,
                alpha,
            ]
            return `rgba(${rgba.join(", ")})`
        } else if (color.length === 7) {
            const rgba = [
                Number.parseInt(color.slice(1, 3), 16),
                Number.parseInt(color.slice(3, 5), 16),
                Number.parseInt(color.slice(5, 7), 16),
                alpha,
            ]
            return `rgba(${rgba.join(", ")})`
        }
    }
    return color
}

export const isSIGGRAPH = false

export const colors = {
    background:  "rgba(38, 38, 38, 1)",
    backgroundA: "rgba(38, 38, 38, 0)",
    red:        "#C92829",
    yellow:     "#FDA400",
    green:      "#95C627",
    olive:      "#09A790",
    blue:       "#06B2DF",
    white:      "#FFFFFF",
    black:      "#000000",
}
