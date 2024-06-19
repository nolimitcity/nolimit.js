// Type definitions for nolimit.js __VERSION__
// https://nolimitjs.nolimitcdn.com/

export = nolimit;

declare namespace nolimit {

    export const version: string;

    export type DeviceType = 'desktop' | 'mobile';

    export interface InitOptions {
        operator: string;
        game?: string;
        language?: string;
        device?: DeviceType;
        environment?: string;
        currency?: string;
        target?: HTMLElement|Window;
        token?: string;
        mute?: boolean;
        version?: string;
        hideCurrency?: boolean;
        lobbyUrl?: string;
        depositUrl?: string;
        supportUrl?: string;
        accountHistoryUrl?: string;
    }

    export interface LoadOptions {
        operator?: string;
        game: string;
        language?: string;
        device?: DeviceType;
        environment?: string;
        currency?: string;
        target?: HTMLElement|Window;
        token?: string;
        mute?: boolean;
        version?: string;
        hideCurrency?: boolean;
    }

    export interface ReplaceOptions {
        operator?: string;
        game: string;
        language?: string;
        device?: DeviceType;
        environment?: string;
        currency?: string;
        target?: HTMLElement|Window;
        token?: string;
        mute?: boolean;
        version?: string;
        hideCurrency?: boolean;
        lobbyUrl?: string;
        depositUrl?: string;
        supportUrl?: string;
        accountHistoryUrl?: string;
    }

    export interface InfoOptions {
        game: string;
        environment?: string;
    }

    export interface GameInfo {
        version: string;
        size: object;
    }

    export interface NolimitApi {
        on: (event: string, callback: (data: object) => void) => void;
        call: (method: string, data: object) => void;
    }

    function init(initOptions: InitOptions): void;
    function load(loadOptions: LoadOptions): NolimitApi;
    function replace(replaceOptions: ReplaceOptions): void;
    function url(urlOptions: ReplaceOptions): string;
    function info(infoOptions: InfoOptions, callback: (info: GameInfo) => void): void;
}
