export function styleElement(element, styles) {
    if (!element || !styles) {
        return
    }
    for (const property of Object.keys(styles)) {
        element.style[property] = styles[property]
    }
}
