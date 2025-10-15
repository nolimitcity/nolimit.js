export function styleElement(element, styles) {
    if (!element || !styles) {
        return
    }
    Object.keys(styles).forEach(property => {
        element.style[property] = styles[property]
    })
}