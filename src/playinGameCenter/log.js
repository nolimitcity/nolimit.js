import { isDev } from "../utils/constants"

export const devLog = (...args) => {
    if (isDev) {
        console.log(...args)
    }
}

export const devInfo = (...args) => {
    if (isDev) {
        console.info(...args)
    }
}
