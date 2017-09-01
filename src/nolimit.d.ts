// Type definitions for nolimit.js

export = nolimit;

declare namespace nolimit {
    export interface InitOptions {
        operator: string;
        game?: string;
        language?: string;
        device?: string;
        environment?: string;
        currency?: string;
        target?: HTMLElement|Window;
        token?: string;
        mute?: boolean;
        version?: string;
        hideCurrency?:boolean;
    }

    export interface LoadOptions {
        operator?: string;
        game: string;
        language?: string;
        device?: string;
        environment?: string;
        currency?: string;
        target?: HTMLElement|Window;
        token?: string;
        mute?: boolean;
        version?: string;
        hideCurrency?:boolean;
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

    function init(options: InitOptions): void;
    function load(options: LoadOptions): NolimitApi;
    function info(options: InfoOptions, callback: (info: GameInfo) => void): void;
}
