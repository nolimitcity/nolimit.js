(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nolimit = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*!
 * UAParser.js v0.7.20
 * Lightweight JavaScript-based User-Agent string parser
 * https://github.com/faisalman/ua-parser-js
 *
 * Copyright © 2012-2019 Faisal Salman <f@faisalman.com>
 * Licensed under MIT License
 */

(function (window, undefined) {

    'use strict';

    //////////////
    // Constants
    /////////////


    var LIBVERSION  = '0.7.20',
        EMPTY       = '',
        UNKNOWN     = '?',
        FUNC_TYPE   = 'function',
        UNDEF_TYPE  = 'undefined',
        OBJ_TYPE    = 'object',
        STR_TYPE    = 'string',
        MAJOR       = 'major', // deprecated
        MODEL       = 'model',
        NAME        = 'name',
        TYPE        = 'type',
        VENDOR      = 'vendor',
        VERSION     = 'version',
        ARCHITECTURE= 'architecture',
        CONSOLE     = 'console',
        MOBILE      = 'mobile',
        TABLET      = 'tablet',
        SMARTTV     = 'smarttv',
        WEARABLE    = 'wearable',
        EMBEDDED    = 'embedded';


    ///////////
    // Helper
    //////////


    var util = {
        extend : function (regexes, extensions) {
            var mergedRegexes = {};
            for (var i in regexes) {
                if (extensions[i] && extensions[i].length % 2 === 0) {
                    mergedRegexes[i] = extensions[i].concat(regexes[i]);
                } else {
                    mergedRegexes[i] = regexes[i];
                }
            }
            return mergedRegexes;
        },
        has : function (str1, str2) {
          if (typeof str1 === "string") {
            return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1;
          } else {
            return false;
          }
        },
        lowerize : function (str) {
            return str.toLowerCase();
        },
        major : function (version) {
            return typeof(version) === STR_TYPE ? version.replace(/[^\d\.]/g,'').split(".")[0] : undefined;
        },
        trim : function (str) {
          return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        }
    };


    ///////////////
    // Map helper
    //////////////


    var mapper = {

        rgx : function (ua, arrays) {

            var i = 0, j, k, p, q, matches, match;

            // loop through all regexes maps
            while (i < arrays.length && !matches) {

                var regex = arrays[i],       // even sequence (0,2,4,..)
                    props = arrays[i + 1];   // odd sequence (1,3,5,..)
                j = k = 0;

                // try matching uastring with regexes
                while (j < regex.length && !matches) {

                    matches = regex[j++].exec(ua);

                    if (!!matches) {
                        for (p = 0; p < props.length; p++) {
                            match = matches[++k];
                            q = props[p];
                            // check if given property is actually array
                            if (typeof q === OBJ_TYPE && q.length > 0) {
                                if (q.length == 2) {
                                    if (typeof q[1] == FUNC_TYPE) {
                                        // assign modified match
                                        this[q[0]] = q[1].call(this, match);
                                    } else {
                                        // assign given value, ignore regex match
                                        this[q[0]] = q[1];
                                    }
                                } else if (q.length == 3) {
                                    // check whether function or regex
                                    if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                                        // call function (usually string mapper)
                                        this[q[0]] = match ? q[1].call(this, match, q[2]) : undefined;
                                    } else {
                                        // sanitize match using given regex
                                        this[q[0]] = match ? match.replace(q[1], q[2]) : undefined;
                                    }
                                } else if (q.length == 4) {
                                        this[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined;
                                }
                            } else {
                                this[q] = match ? match : undefined;
                            }
                        }
                    }
                }
                i += 2;
            }
        },

        str : function (str, map) {

            for (var i in map) {
                // check if array
                if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
                    for (var j = 0; j < map[i].length; j++) {
                        if (util.has(map[i][j], str)) {
                            return (i === UNKNOWN) ? undefined : i;
                        }
                    }
                } else if (util.has(map[i], str)) {
                    return (i === UNKNOWN) ? undefined : i;
                }
            }
            return str;
        }
    };


    ///////////////
    // String map
    //////////////


    var maps = {

        browser : {
            oldsafari : {
                version : {
                    '1.0'   : '/8',
                    '1.2'   : '/1',
                    '1.3'   : '/3',
                    '2.0'   : '/412',
                    '2.0.2' : '/416',
                    '2.0.3' : '/417',
                    '2.0.4' : '/419',
                    '?'     : '/'
                }
            }
        },

        device : {
            amazon : {
                model : {
                    'Fire Phone' : ['SD', 'KF']
                }
            },
            sprint : {
                model : {
                    'Evo Shift 4G' : '7373KT'
                },
                vendor : {
                    'HTC'       : 'APA',
                    'Sprint'    : 'Sprint'
                }
            }
        },

        os : {
            windows : {
                version : {
                    'ME'        : '4.90',
                    'NT 3.11'   : 'NT3.51',
                    'NT 4.0'    : 'NT4.0',
                    '2000'      : 'NT 5.0',
                    'XP'        : ['NT 5.1', 'NT 5.2'],
                    'Vista'     : 'NT 6.0',
                    '7'         : 'NT 6.1',
                    '8'         : 'NT 6.2',
                    '8.1'       : 'NT 6.3',
                    '10'        : ['NT 6.4', 'NT 10.0'],
                    'RT'        : 'ARM'
                }
            }
        }
    };


    //////////////
    // Regex map
    /////////////


    var regexes = {

        browser : [[

            // Presto based
            /(opera\smini)\/([\w\.-]+)/i,                                       // Opera Mini
            /(opera\s[mobiletab]+).+version\/([\w\.-]+)/i,                      // Opera Mobi/Tablet
            /(opera).+version\/([\w\.]+)/i,                                     // Opera > 9.80
            /(opera)[\/\s]+([\w\.]+)/i                                          // Opera < 9.80
            ], [NAME, VERSION], [

            /(opios)[\/\s]+([\w\.]+)/i                                          // Opera mini on iphone >= 8.0
            ], [[NAME, 'Opera Mini'], VERSION], [

            /\s(opr)\/([\w\.]+)/i                                               // Opera Webkit
            ], [[NAME, 'Opera'], VERSION], [

            // Mixed
            /(kindle)\/([\w\.]+)/i,                                             // Kindle
            /(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]*)/i,
                                                                                // Lunascape/Maxthon/Netfront/Jasmine/Blazer

            // Trident based
            /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,
                                                                                // Avant/IEMobile/SlimBrowser/Baidu
            /(?:ms|\()(ie)\s([\w\.]+)/i,                                        // Internet Explorer

            // Webkit/KHTML based
            /(rekonq)\/([\w\.]*)/i,                                             // Rekonq
            /(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon)\/([\w\.-]+)/i
                                                                                // Chromium/Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS/Bowser/QupZilla/Falkon
            ], [NAME, VERSION], [

            /(konqueror)\/([\w\.]+)/i                                           // Konqueror
            ], [[NAME, 'Konqueror'], VERSION], [

            /(trident).+rv[:\s]([\w\.]+).+like\sgecko/i                         // IE11
            ], [[NAME, 'IE'], VERSION], [

            /(edge|edgios|edga|edg)\/((\d+)?[\w\.]+)/i                          // Microsoft Edge
            ], [[NAME, 'Edge'], VERSION], [

            /(yabrowser)\/([\w\.]+)/i                                           // Yandex
            ], [[NAME, 'Yandex'], VERSION], [

            /(puffin)\/([\w\.]+)/i                                              // Puffin
            ], [[NAME, 'Puffin'], VERSION], [

            /(focus)\/([\w\.]+)/i                                               // Firefox Focus
            ], [[NAME, 'Firefox Focus'], VERSION], [

            /(opt)\/([\w\.]+)/i                                                 // Opera Touch
            ], [[NAME, 'Opera Touch'], VERSION], [

            /((?:[\s\/])uc?\s?browser|(?:juc.+)ucweb)[\/\s]?([\w\.]+)/i         // UCBrowser
            ], [[NAME, 'UCBrowser'], VERSION], [

            /(comodo_dragon)\/([\w\.]+)/i                                       // Comodo Dragon
            ], [[NAME, /_/g, ' '], VERSION], [

            /(windowswechat qbcore)\/([\w\.]+)/i                                // WeChat Desktop for Windows Built-in Browser
            ], [[NAME, 'WeChat(Win) Desktop'], VERSION], [

            /(micromessenger)\/([\w\.]+)/i                                      // WeChat
            ], [[NAME, 'WeChat'], VERSION], [

            /(brave)\/([\w\.]+)/i                                              // Brave browser
            ], [[NAME, 'Brave'], VERSION], [

            /(qqbrowserlite)\/([\w\.]+)/i                                       // QQBrowserLite
            ], [NAME, VERSION], [

            /(QQ)\/([\d\.]+)/i                                                  // QQ, aka ShouQ
            ], [NAME, VERSION], [

            /m?(qqbrowser)[\/\s]?([\w\.]+)/i                                    // QQBrowser
            ], [NAME, VERSION], [

            /(BIDUBrowser)[\/\s]?([\w\.]+)/i                                    // Baidu Browser
            ], [NAME, VERSION], [

            /(2345Explorer)[\/\s]?([\w\.]+)/i                                   // 2345 Browser
            ], [NAME, VERSION], [

            /(MetaSr)[\/\s]?([\w\.]+)/i                                         // SouGouBrowser
            ], [NAME], [

            /(LBBROWSER)/i                                      // LieBao Browser
            ], [NAME], [

            /xiaomi\/miuibrowser\/([\w\.]+)/i                                   // MIUI Browser
            ], [VERSION, [NAME, 'MIUI Browser']], [

            /;fbav\/([\w\.]+);/i                                                // Facebook App for iOS & Android
            ], [VERSION, [NAME, 'Facebook']], [

            /safari\s(line)\/([\w\.]+)/i,                                       // Line App for iOS
            /android.+(line)\/([\w\.]+)\/iab/i                                  // Line App for Android
            ], [NAME, VERSION], [

            /headlesschrome(?:\/([\w\.]+)|\s)/i                                 // Chrome Headless
            ], [VERSION, [NAME, 'Chrome Headless']], [

            /\swv\).+(chrome)\/([\w\.]+)/i                                      // Chrome WebView
            ], [[NAME, /(.+)/, '$1 WebView'], VERSION], [

            /((?:oculus|samsung)browser)\/([\w\.]+)/i
            ], [[NAME, /(.+(?:g|us))(.+)/, '$1 $2'], VERSION], [                // Oculus / Samsung Browser

            /android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)*/i        // Android Browser
            ], [VERSION, [NAME, 'Android Browser']], [

            /(sailfishbrowser)\/([\w\.]+)/i                                     // Sailfish Browser
            ], [[NAME, 'Sailfish Browser'], VERSION], [

            /(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i
                                                                                // Chrome/OmniWeb/Arora/Tizen/Nokia
            ], [NAME, VERSION], [

            /(dolfin)\/([\w\.]+)/i                                              // Dolphin
            ], [[NAME, 'Dolphin'], VERSION], [

            /((?:android.+)crmo|crios)\/([\w\.]+)/i                             // Chrome for Android/iOS
            ], [[NAME, 'Chrome'], VERSION], [

            /(coast)\/([\w\.]+)/i                                               // Opera Coast
            ], [[NAME, 'Opera Coast'], VERSION], [

            /fxios\/([\w\.-]+)/i                                                // Firefox for iOS
            ], [VERSION, [NAME, 'Firefox']], [

            /version\/([\w\.]+).+?mobile\/\w+\s(safari)/i                       // Mobile Safari
            ], [VERSION, [NAME, 'Mobile Safari']], [

            /version\/([\w\.]+).+?(mobile\s?safari|safari)/i                    // Safari & Safari Mobile
            ], [VERSION, NAME], [

            /webkit.+?(gsa)\/([\w\.]+).+?(mobile\s?safari|safari)(\/[\w\.]+)/i  // Google Search Appliance on iOS
            ], [[NAME, 'GSA'], VERSION], [

            /webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i                     // Safari < 3.0
            ], [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]], [

            /(webkit|khtml)\/([\w\.]+)/i
            ], [NAME, VERSION], [

            // Gecko based
            /(navigator|netscape)\/([\w\.-]+)/i                                 // Netscape
            ], [[NAME, 'Netscape'], VERSION], [
            /(swiftfox)/i,                                                      // Swiftfox
            /(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,
                                                                                // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror
            /(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([\w\.-]+)$/i,

                                                                                // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
            /(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i,                          // Mozilla

            // Other
            /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir)[\/\s]?([\w\.]+)/i,
                                                                                // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir
            /(links)\s\(([\w\.]+)/i,                                            // Links
            /(gobrowser)\/?([\w\.]*)/i,                                         // GoBrowser
            /(ice\s?browser)\/v?([\w\._]+)/i,                                   // ICE Browser
            /(mosaic)[\/\s]([\w\.]+)/i                                          // Mosaic
            ], [NAME, VERSION]
        ],

        cpu : [[

            /(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i                     // AMD64
            ], [[ARCHITECTURE, 'amd64']], [

            /(ia32(?=;))/i                                                      // IA32 (quicktime)
            ], [[ARCHITECTURE, util.lowerize]], [

            /((?:i[346]|x)86)[;\)]/i                                            // IA32
            ], [[ARCHITECTURE, 'ia32']], [

            // PocketPC mistakenly identified as PowerPC
            /windows\s(ce|mobile);\sppc;/i
            ], [[ARCHITECTURE, 'arm']], [

            /((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i                           // PowerPC
            ], [[ARCHITECTURE, /ower/, '', util.lowerize]], [

            /(sun4\w)[;\)]/i                                                    // SPARC
            ], [[ARCHITECTURE, 'sparc']], [

            /((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+[;l]))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i
                                                                                // IA64, 68K, ARM/64, AVR/32, IRIX/64, MIPS/64, SPARC/64, PA-RISC
            ], [[ARCHITECTURE, util.lowerize]]
        ],

        device : [[

            /\((ipad|playbook);[\w\s\),;-]+(rim|apple)/i                        // iPad/PlayBook
            ], [MODEL, VENDOR, [TYPE, TABLET]], [

            /applecoremedia\/[\w\.]+ \((ipad)/                                  // iPad
            ], [MODEL, [VENDOR, 'Apple'], [TYPE, TABLET]], [

            /(apple\s{0,1}tv)/i                                                 // Apple TV
            ], [[MODEL, 'Apple TV'], [VENDOR, 'Apple']], [

            /(archos)\s(gamepad2?)/i,                                           // Archos
            /(hp).+(touchpad)/i,                                                // HP TouchPad
            /(hp).+(tablet)/i,                                                  // HP Tablet
            /(kindle)\/([\w\.]+)/i,                                             // Kindle
            /\s(nook)[\w\s]+build\/(\w+)/i,                                     // Nook
            /(dell)\s(strea[kpr\s\d]*[\dko])/i                                  // Dell Streak
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /(kf[A-z]+)\sbuild\/.+silk\//i                                      // Kindle Fire HD
            ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [
            /(sd|kf)[0349hijorstuw]+\sbuild\/.+silk\//i                         // Fire Phone
            ], [[MODEL, mapper.str, maps.device.amazon.model], [VENDOR, 'Amazon'], [TYPE, MOBILE]], [
            /android.+aft([bms])\sbuild/i                                       // Fire TV
            ], [MODEL, [VENDOR, 'Amazon'], [TYPE, SMARTTV]], [

            /\((ip[honed|\s\w*]+);.+(apple)/i                                   // iPod/iPhone
            ], [MODEL, VENDOR, [TYPE, MOBILE]], [
            /\((ip[honed|\s\w*]+);/i                                            // iPod/iPhone
            ], [MODEL, [VENDOR, 'Apple'], [TYPE, MOBILE]], [

            /(blackberry)[\s-]?(\w+)/i,                                         // BlackBerry
            /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[\s_-]?([\w-]*)/i,
                                                                                // BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Meizu/Motorola/Polytron
            /(hp)\s([\w\s]+\w)/i,                                               // HP iPAQ
            /(asus)-?(\w+)/i                                                    // Asus
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /\(bb10;\s(\w+)/i                                                   // BlackBerry 10
            ], [MODEL, [VENDOR, 'BlackBerry'], [TYPE, MOBILE]], [
                                                                                // Asus Tablets
            /android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7|padfone|p00c)/i
            ], [MODEL, [VENDOR, 'Asus'], [TYPE, TABLET]], [

            /(sony)\s(tablet\s[ps])\sbuild\//i,                                  // Sony
            /(sony)?(?:sgp.+)\sbuild\//i
            ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Tablet'], [TYPE, TABLET]], [
            /android.+\s([c-g]\d{4}|so[-l]\w+)(?=\sbuild\/|\).+chrome\/(?![1-6]{0,1}\d\.))/i
            ], [MODEL, [VENDOR, 'Sony'], [TYPE, MOBILE]], [

            /\s(ouya)\s/i,                                                      // Ouya
            /(nintendo)\s([wids3u]+)/i                                          // Nintendo
            ], [VENDOR, MODEL, [TYPE, CONSOLE]], [

            /android.+;\s(shield)\sbuild/i                                      // Nvidia
            ], [MODEL, [VENDOR, 'Nvidia'], [TYPE, CONSOLE]], [

            /(playstation\s[34portablevi]+)/i                                   // Playstation
            ], [MODEL, [VENDOR, 'Sony'], [TYPE, CONSOLE]], [

            /(sprint\s(\w+))/i                                                  // Sprint Phones
            ], [[VENDOR, mapper.str, maps.device.sprint.vendor], [MODEL, mapper.str, maps.device.sprint.model], [TYPE, MOBILE]], [

            /(htc)[;_\s-]+([\w\s]+(?=\)|\sbuild)|\w+)/i,                        // HTC
            /(zte)-(\w*)/i,                                                     // ZTE
            /(alcatel|geeksphone|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]*)/i
                                                                                // Alcatel/GeeksPhone/Nexian/Panasonic/Sony
            ], [VENDOR, [MODEL, /_/g, ' '], [TYPE, MOBILE]], [

            /(nexus\s9)/i                                                       // HTC Nexus 9
            ], [MODEL, [VENDOR, 'HTC'], [TYPE, TABLET]], [

            /d\/huawei([\w\s-]+)[;\)]/i,
            /(nexus\s6p)/i                                                      // Huawei
            ], [MODEL, [VENDOR, 'Huawei'], [TYPE, MOBILE]], [

            /(microsoft);\s(lumia[\s\w]+)/i                                     // Microsoft Lumia
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [

            /[\s\(;](xbox(?:\sone)?)[\s\);]/i                                   // Microsoft Xbox
            ], [MODEL, [VENDOR, 'Microsoft'], [TYPE, CONSOLE]], [
            /(kin\.[onetw]{3})/i                                                // Microsoft Kin
            ], [[MODEL, /\./g, ' '], [VENDOR, 'Microsoft'], [TYPE, MOBILE]], [

                                                                                // Motorola
            /\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?:?(\s4g)?)[\w\s]+build\//i,
            /mot[\s-]?(\w*)/i,
            /(XT\d{3,4}) build\//i,
            /(nexus\s6)/i
            ], [MODEL, [VENDOR, 'Motorola'], [TYPE, MOBILE]], [
            /android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i
            ], [MODEL, [VENDOR, 'Motorola'], [TYPE, TABLET]], [

            /hbbtv\/\d+\.\d+\.\d+\s+\([\w\s]*;\s*(\w[^;]*);([^;]*)/i            // HbbTV devices
            ], [[VENDOR, util.trim], [MODEL, util.trim], [TYPE, SMARTTV]], [

            /hbbtv.+maple;(\d+)/i
            ], [[MODEL, /^/, 'SmartTV'], [VENDOR, 'Samsung'], [TYPE, SMARTTV]], [

            /\(dtv[\);].+(aquos)/i                                              // Sharp
            ], [MODEL, [VENDOR, 'Sharp'], [TYPE, SMARTTV]], [

            /android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n\d+|sgh-t8[56]9|nexus 10))/i,
            /((SM-T\w+))/i
            ], [[VENDOR, 'Samsung'], MODEL, [TYPE, TABLET]], [                  // Samsung
            /smart-tv.+(samsung)/i
            ], [VENDOR, [TYPE, SMARTTV], MODEL], [
            /((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-\w[\w\d]+))/i,
            /(sam[sung]*)[\s-]*(\w+-?[\w-]*)/i,
            /sec-((sgh\w+))/i
            ], [[VENDOR, 'Samsung'], MODEL, [TYPE, MOBILE]], [

            /sie-(\w*)/i                                                        // Siemens
            ], [MODEL, [VENDOR, 'Siemens'], [TYPE, MOBILE]], [

            /(maemo|nokia).*(n900|lumia\s\d+)/i,                                // Nokia
            /(nokia)[\s_-]?([\w-]*)/i
            ], [[VENDOR, 'Nokia'], MODEL, [TYPE, MOBILE]], [

            /android[x\d\.\s;]+\s([ab][1-7]\-?[0178a]\d\d?)/i                   // Acer
            ], [MODEL, [VENDOR, 'Acer'], [TYPE, TABLET]], [

            /android.+([vl]k\-?\d{3})\s+build/i                                 // LG Tablet
            ], [MODEL, [VENDOR, 'LG'], [TYPE, TABLET]], [
            /android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i                     // LG Tablet
            ], [[VENDOR, 'LG'], MODEL, [TYPE, TABLET]], [
            /(lg) netcast\.tv/i                                                 // LG SmartTV
            ], [VENDOR, MODEL, [TYPE, SMARTTV]], [
            /(nexus\s[45])/i,                                                   // LG
            /lg[e;\s\/-]+(\w*)/i,
            /android.+lg(\-?[\d\w]+)\s+build/i
            ], [MODEL, [VENDOR, 'LG'], [TYPE, MOBILE]], [

            /(lenovo)\s?(s(?:5000|6000)(?:[\w-]+)|tab(?:[\s\w]+))/i             // Lenovo tablets
            ], [VENDOR, MODEL, [TYPE, TABLET]], [
            /android.+(ideatab[a-z0-9\-\s]+)/i                                  // Lenovo
            ], [MODEL, [VENDOR, 'Lenovo'], [TYPE, TABLET]], [
            /(lenovo)[_\s-]?([\w-]+)/i
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [

            /linux;.+((jolla));/i                                               // Jolla
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [

            /((pebble))app\/[\d\.]+\s/i                                         // Pebble
            ], [VENDOR, MODEL, [TYPE, WEARABLE]], [

            /android.+;\s(oppo)\s?([\w\s]+)\sbuild/i                            // OPPO
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [

            /crkey/i                                                            // Google Chromecast
            ], [[MODEL, 'Chromecast'], [VENDOR, 'Google']], [

            /android.+;\s(glass)\s\d/i                                          // Google Glass
            ], [MODEL, [VENDOR, 'Google'], [TYPE, WEARABLE]], [

            /android.+;\s(pixel c)[\s)]/i                                       // Google Pixel C
            ], [MODEL, [VENDOR, 'Google'], [TYPE, TABLET]], [

            /android.+;\s(pixel( [23])?( xl)?)[\s)]/i                              // Google Pixel
            ], [MODEL, [VENDOR, 'Google'], [TYPE, MOBILE]], [

            /android.+;\s(\w+)\s+build\/hm\1/i,                                 // Xiaomi Hongmi 'numeric' models
            /android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i,               // Xiaomi Hongmi
            /android.+(mi[\s\-_]*(?:a\d|one|one[\s_]plus|note lte)?[\s_]*(?:\d?\w?)[\s_]*(?:plus)?)\s+build/i,    
                                                                                // Xiaomi Mi
            /android.+(redmi[\s\-_]*(?:note)?(?:[\s_]*[\w\s]+))\s+build/i       // Redmi Phones
            ], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, MOBILE]], [
            /android.+(mi[\s\-_]*(?:pad)(?:[\s_]*[\w\s]+))\s+build/i            // Mi Pad tablets
            ],[[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, TABLET]], [
            /android.+;\s(m[1-5]\snote)\sbuild/i                                // Meizu
            ], [MODEL, [VENDOR, 'Meizu'], [TYPE, MOBILE]], [
            /(mz)-([\w-]{2,})/i
            ], [[VENDOR, 'Meizu'], MODEL, [TYPE, MOBILE]], [

            /android.+a000(1)\s+build/i,                                        // OnePlus
            /android.+oneplus\s(a\d{4})\s+build/i
            ], [MODEL, [VENDOR, 'OnePlus'], [TYPE, MOBILE]], [

            /android.+[;\/]\s*(RCT[\d\w]+)\s+build/i                            // RCA Tablets
            ], [MODEL, [VENDOR, 'RCA'], [TYPE, TABLET]], [

            /android.+[;\/\s]+(Venue[\d\s]{2,7})\s+build/i                      // Dell Venue Tablets
            ], [MODEL, [VENDOR, 'Dell'], [TYPE, TABLET]], [

            /android.+[;\/]\s*(Q[T|M][\d\w]+)\s+build/i                         // Verizon Tablet
            ], [MODEL, [VENDOR, 'Verizon'], [TYPE, TABLET]], [

            /android.+[;\/]\s+(Barnes[&\s]+Noble\s+|BN[RT])(V?.*)\s+build/i     // Barnes & Noble Tablet
            ], [[VENDOR, 'Barnes & Noble'], MODEL, [TYPE, TABLET]], [

            /android.+[;\/]\s+(TM\d{3}.*\b)\s+build/i                           // Barnes & Noble Tablet
            ], [MODEL, [VENDOR, 'NuVision'], [TYPE, TABLET]], [

            /android.+;\s(k88)\sbuild/i                                         // ZTE K Series Tablet
            ], [MODEL, [VENDOR, 'ZTE'], [TYPE, TABLET]], [

            /android.+[;\/]\s*(gen\d{3})\s+build.*49h/i                         // Swiss GEN Mobile
            ], [MODEL, [VENDOR, 'Swiss'], [TYPE, MOBILE]], [

            /android.+[;\/]\s*(zur\d{3})\s+build/i                              // Swiss ZUR Tablet
            ], [MODEL, [VENDOR, 'Swiss'], [TYPE, TABLET]], [

            /android.+[;\/]\s*((Zeki)?TB.*\b)\s+build/i                         // Zeki Tablets
            ], [MODEL, [VENDOR, 'Zeki'], [TYPE, TABLET]], [

            /(android).+[;\/]\s+([YR]\d{2})\s+build/i,
            /android.+[;\/]\s+(Dragon[\-\s]+Touch\s+|DT)(\w{5})\sbuild/i        // Dragon Touch Tablet
            ], [[VENDOR, 'Dragon Touch'], MODEL, [TYPE, TABLET]], [

            /android.+[;\/]\s*(NS-?\w{0,9})\sbuild/i                            // Insignia Tablets
            ], [MODEL, [VENDOR, 'Insignia'], [TYPE, TABLET]], [

            /android.+[;\/]\s*((NX|Next)-?\w{0,9})\s+build/i                    // NextBook Tablets
            ], [MODEL, [VENDOR, 'NextBook'], [TYPE, TABLET]], [

            /android.+[;\/]\s*(Xtreme\_)?(V(1[045]|2[015]|30|40|60|7[05]|90))\s+build/i
            ], [[VENDOR, 'Voice'], MODEL, [TYPE, MOBILE]], [                    // Voice Xtreme Phones

            /android.+[;\/]\s*(LVTEL\-)?(V1[12])\s+build/i                     // LvTel Phones
            ], [[VENDOR, 'LvTel'], MODEL, [TYPE, MOBILE]], [

            /android.+;\s(PH-1)\s/i
            ], [MODEL, [VENDOR, 'Essential'], [TYPE, MOBILE]], [                // Essential PH-1

            /android.+[;\/]\s*(V(100MD|700NA|7011|917G).*\b)\s+build/i          // Envizen Tablets
            ], [MODEL, [VENDOR, 'Envizen'], [TYPE, TABLET]], [

            /android.+[;\/]\s*(Le[\s\-]+Pan)[\s\-]+(\w{1,9})\s+build/i          // Le Pan Tablets
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /android.+[;\/]\s*(Trio[\s\-]*.*)\s+build/i                         // MachSpeed Tablets
            ], [MODEL, [VENDOR, 'MachSpeed'], [TYPE, TABLET]], [

            /android.+[;\/]\s*(Trinity)[\-\s]*(T\d{3})\s+build/i                // Trinity Tablets
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /android.+[;\/]\s*TU_(1491)\s+build/i                               // Rotor Tablets
            ], [MODEL, [VENDOR, 'Rotor'], [TYPE, TABLET]], [

            /android.+(KS(.+))\s+build/i                                        // Amazon Kindle Tablets
            ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [

            /android.+(Gigaset)[\s\-]+(Q\w{1,9})\s+build/i                      // Gigaset Tablets
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /\s(tablet|tab)[;\/]/i,                                             // Unidentifiable Tablet
            /\s(mobile)(?:[;\/]|\ssafari)/i                                     // Unidentifiable Mobile
            ], [[TYPE, util.lowerize], VENDOR, MODEL], [

            /[\s\/\(](smart-?tv)[;\)]/i                                         // SmartTV
            ], [[TYPE, SMARTTV]], [

            /(android[\w\.\s\-]{0,9});.+build/i                                 // Generic Android Device
            ], [MODEL, [VENDOR, 'Generic']]
        ],

        engine : [[

            /windows.+\sedge\/([\w\.]+)/i                                       // EdgeHTML
            ], [VERSION, [NAME, 'EdgeHTML']], [

            /webkit\/537\.36.+chrome\/(?!27)/i                                  // Blink
            ], [[NAME, 'Blink']], [

            /(presto)\/([\w\.]+)/i,                                             // Presto
            /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i,     
                                                                                // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m/Goanna
            /(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i,                          // KHTML/Tasman/Links
            /(icab)[\/\s]([23]\.[\d\.]+)/i                                      // iCab
            ], [NAME, VERSION], [

            /rv\:([\w\.]{1,9}).+(gecko)/i                                       // Gecko
            ], [VERSION, NAME]
        ],

        os : [[

            // Windows based
            /microsoft\s(windows)\s(vista|xp)/i                                 // Windows (iTunes)
            ], [NAME, VERSION], [
            /(windows)\snt\s6\.2;\s(arm)/i,                                     // Windows RT
            /(windows\sphone(?:\sos)*)[\s\/]?([\d\.\s\w]*)/i,                   // Windows Phone
            /(windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i
            ], [NAME, [VERSION, mapper.str, maps.os.windows.version]], [
            /(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i
            ], [[NAME, 'Windows'], [VERSION, mapper.str, maps.os.windows.version]], [

            // Mobile/Embedded OS
            /\((bb)(10);/i                                                      // BlackBerry 10
            ], [[NAME, 'BlackBerry'], VERSION], [
            /(blackberry)\w*\/?([\w\.]*)/i,                                     // Blackberry
            /(tizen)[\/\s]([\w\.]+)/i,                                          // Tizen
            /(android|webos|palm\sos|qnx|bada|rim\stablet\sos|meego|sailfish|contiki)[\/\s-]?([\w\.]*)/i
                                                                                // Android/WebOS/Palm/QNX/Bada/RIM/MeeGo/Contiki/Sailfish OS
            ], [NAME, VERSION], [
            /(symbian\s?os|symbos|s60(?=;))[\/\s-]?([\w\.]*)/i                  // Symbian
            ], [[NAME, 'Symbian'], VERSION], [
            /\((series40);/i                                                    // Series 40
            ], [NAME], [
            /mozilla.+\(mobile;.+gecko.+firefox/i                               // Firefox OS
            ], [[NAME, 'Firefox OS'], VERSION], [

            // Console
            /(nintendo|playstation)\s([wids34portablevu]+)/i,                   // Nintendo/Playstation

            // GNU/Linux based
            /(mint)[\/\s\(]?(\w*)/i,                                            // Mint
            /(mageia|vectorlinux)[;\s]/i,                                       // Mageia/VectorLinux
            /(joli|[kxln]?ubuntu|debian|suse|opensuse|gentoo|(?=\s)arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?(?!chrom)([\w\.-]*)/i,
                                                                                // Joli/Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware
                                                                                // Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus
            /(hurd|linux)\s?([\w\.]*)/i,                                        // Hurd/Linux
            /(gnu)\s?([\w\.]*)/i                                                // GNU
            ], [NAME, VERSION], [

            /(cros)\s[\w]+\s([\w\.]+\w)/i                                       // Chromium OS
            ], [[NAME, 'Chromium OS'], VERSION],[

            // Solaris
            /(sunos)\s?([\w\.\d]*)/i                                            // Solaris
            ], [[NAME, 'Solaris'], VERSION], [

            // BSD based
            /\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]*)/i                    // FreeBSD/NetBSD/OpenBSD/PC-BSD/DragonFly
            ], [NAME, VERSION],[

            /(haiku)\s(\w+)/i                                                   // Haiku
            ], [NAME, VERSION],[

            /cfnetwork\/.+darwin/i,
            /ip[honead]{2,4}(?:.*os\s([\w]+)\slike\smac|;\sopera)/i             // iOS
            ], [[VERSION, /_/g, '.'], [NAME, 'iOS']], [

            /(mac\sos\sx)\s?([\w\s\.]*)/i,
            /(macintosh|mac(?=_powerpc)\s)/i                                    // Mac OS
            ], [[NAME, 'Mac OS'], [VERSION, /_/g, '.']], [

            // Other
            /((?:open)?solaris)[\/\s-]?([\w\.]*)/i,                             // Solaris
            /(aix)\s((\d)(?=\.|\)|\s)[\w\.])*/i,                                // AIX
            /(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms|fuchsia)/i,
                                                                                // Plan9/Minix/BeOS/OS2/AmigaOS/MorphOS/RISCOS/OpenVMS/Fuchsia
            /(unix)\s?([\w\.]*)/i                                               // UNIX
            ], [NAME, VERSION]
        ]
    };


    /////////////////
    // Constructor
    ////////////////
    var UAParser = function (uastring, extensions) {

        if (typeof uastring === 'object') {
            extensions = uastring;
            uastring = undefined;
        }

        if (!(this instanceof UAParser)) {
            return new UAParser(uastring, extensions).getResult();
        }

        var ua = uastring || ((window && window.navigator && window.navigator.userAgent) ? window.navigator.userAgent : EMPTY);
        var rgxmap = extensions ? util.extend(regexes, extensions) : regexes;

        this.getBrowser = function () {
            var browser = { name: undefined, version: undefined };
            mapper.rgx.call(browser, ua, rgxmap.browser);
            browser.major = util.major(browser.version); // deprecated
            return browser;
        };
        this.getCPU = function () {
            var cpu = { architecture: undefined };
            mapper.rgx.call(cpu, ua, rgxmap.cpu);
            return cpu;
        };
        this.getDevice = function () {
            var device = { vendor: undefined, model: undefined, type: undefined };
            mapper.rgx.call(device, ua, rgxmap.device);
            return device;
        };
        this.getEngine = function () {
            var engine = { name: undefined, version: undefined };
            mapper.rgx.call(engine, ua, rgxmap.engine);
            return engine;
        };
        this.getOS = function () {
            var os = { name: undefined, version: undefined };
            mapper.rgx.call(os, ua, rgxmap.os);
            return os;
        };
        this.getResult = function () {
            return {
                ua      : this.getUA(),
                browser : this.getBrowser(),
                engine  : this.getEngine(),
                os      : this.getOS(),
                device  : this.getDevice(),
                cpu     : this.getCPU()
            };
        };
        this.getUA = function () {
            return ua;
        };
        this.setUA = function (uastring) {
            ua = uastring;
            return this;
        };
        return this;
    };

    UAParser.VERSION = LIBVERSION;
    UAParser.BROWSER = {
        NAME    : NAME,
        MAJOR   : MAJOR, // deprecated
        VERSION : VERSION
    };
    UAParser.CPU = {
        ARCHITECTURE : ARCHITECTURE
    };
    UAParser.DEVICE = {
        MODEL   : MODEL,
        VENDOR  : VENDOR,
        TYPE    : TYPE,
        CONSOLE : CONSOLE,
        MOBILE  : MOBILE,
        SMARTTV : SMARTTV,
        TABLET  : TABLET,
        WEARABLE: WEARABLE,
        EMBEDDED: EMBEDDED
    };
    UAParser.ENGINE = {
        NAME    : NAME,
        VERSION : VERSION
    };
    UAParser.OS = {
        NAME    : NAME,
        VERSION : VERSION
    };

    ///////////
    // Export
    //////////


    // check js environment
    if (typeof(exports) !== UNDEF_TYPE) {
        // nodejs env
        if (typeof module !== UNDEF_TYPE && module.exports) {
            exports = module.exports = UAParser;
        }
        exports.UAParser = UAParser;
    } else {
        // requirejs env (optional)
        if (typeof(define) === 'function' && define.amd) {
            define(function () {
                return UAParser;
            });
        } else if (window) {
            // browser env
            window.UAParser = UAParser;
        }
    }

    // jQuery/Zepto specific (optional)
    // Note:
    //   In AMD env the global scope should be kept clean, but jQuery is an exception.
    //   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
    //   and we should catch that.
    var $ = window && (window.jQuery || window.Zepto);
    if (typeof $ !== UNDEF_TYPE && !$.ua) {
        var parser = new UAParser();
        $.ua = parser.getResult();
        $.ua.get = function () {
            return parser.getUA();
        };
        $.ua.set = function (uastring) {
            parser.setUA(uastring);
            var result = parser.getResult();
            for (var prop in result) {
                $.ua[prop] = result[prop];
            }
        };
    }

})(typeof window === 'object' ? window : this);

},{}],2:[function(require,module,exports){
var logHandler = require('./log-handler');

var info = {
    load: function(options, callback) {
        var parts = [options.staticRoot, options.game];
        if(options.version) {
            parts.push(options.version);
        }
        parts.push('info.json');

        var url = parts.join('/');
        var request = new XMLHttpRequest();

        function onFail() {
            var error = request.statusText || 'No error message available; CORS or server missing?';
            callback({
                error: error
            });
        }

        request.open('GET', url, true);

        request.onload = function() {
            if(request.status >= 200 && request.status < 400) {
                var info;
                try {
                    info = JSON.parse(request.responseText);
                    info.staticRoot = [options.staticRoot, info.name, info.version].join('/');
                    info.aspectRatio = info.size.width / info.size.height;
                    info.infoJson = url;

                    logHandler.setExtra('version', info.version);
                    var country = request.getResponseHeader('x-country');
                    if(country) {
                        info.country = country;
                        logHandler.setExtra('country', country);
                    }
                } catch(e) {
                    callback({
                        error: e.message
                    });
                    return;
                }
                callback(info);
            } else {
                onFail();
            }
        };

        request.onerror = onFail;

        request.send();
    }
};

module.exports = info;

},{"./log-handler":7}],3:[function(require,module,exports){
module.exports = '#nolimit-swipe-blocker {\n    height: 120vh;\n    position: fixed;\n    top: 0;\n    z-index: 2;\n}\n\n#nolimit-swipe-overlay {\n    background-color: black;\n    opacity: 0.5;\n    width: 100%;\n    height: 100%;\n    position: fixed;\n    top: 0;\n    left: 0;\n}\n\n#nolimit-swipe-arrow {\n    height: 30%;\n    width: 30%;\n    top: 35vh;\n    left: 30vw;\n    pointer-events: none;\n    z-index: 10;\n    position: fixed;\n}\n\n@keyframes nolimit-finger {\n    from {\n        top: 55vh;\n    }\n    to {\n        top: 35vh;\n    }\n}\n\n#nolimit-swipe-finger {\n    height: 30%;\n    width: 30%;\n    top: 55vh;\n    left: 36vw;\n    pointer-events: none;\n    z-index: 10;\n    position: fixed;\n\n    animation-duration: 1s;\n    animation-name: nolimit-finger;\n    animation-iteration-count: infinite;\n    animation-direction: alternate;\n}\n';
},{}],4:[function(require,module,exports){
var BASE_URL = 'https://nolimitjs.nolimitcdn.com/img';
var FINGER = BASE_URL + '/finger.svg';
var ARROW = BASE_URL + '/arrow.svg';

var fullscreen = false;

function preventResize(e) {
    if(e.scale !== 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function getOrientation() {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

function addCss(document) {
    var style = document.createElement('style');
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(require('./ios-fullscreen.css')));
}

var iosFullscreen = {
    init: function(options, document) {
        var ua = navigator.userAgent.toLowerCase();
        var iPhone = ua.indexOf('iphone') !== -1;
        var isChrome = ua.indexOf('crios') !== -1;
        var isFirefox = ua.indexOf('fxios') !== -1;
        var isYandex = ua.indexOf('yabrowser') !== -1;
        var standalone = navigator.standalone === true;
        var iFramed = window.top !== window.self;


        if(!iPhone || isChrome || isFirefox || isYandex || standalone || iFramed || options.device !== 'mobile') {
            return;
        }

        addCss(document);

        // The element that prevents swipes later
        var swipeBlocker = document.createElement('div');
        swipeBlocker.id = 'nolimit-swipe-blocker';

        // The Element containing the swipe up animation
        var swipeOverlay = document.createElement('div');
        swipeOverlay.id = 'nolimit-swipe-overlay';

        var finger = document.createElement('img');
        finger.id = 'nolimit-swipe-finger';
        finger.src = FINGER;
        swipeOverlay.appendChild(finger);

        var arrow = document.createElement('img');
        arrow.id = 'nolimit-swipe-arrow';
        arrow.src = ARROW;
        swipeOverlay.appendChild(arrow);

        swipeBlocker.addEventListener('touchmove', preventResize);
        arrow.addEventListener('touchmove', preventResize);

        document.body.appendChild(swipeBlocker);
        document.body.appendChild(swipeOverlay);

        function enableOverlay() {
            window.focus();
            window.scrollTo(0, 0);
            swipeBlocker.style.visibility = 'visible';
            swipeBlocker.style.pointerEvents = 'auto';
        }

        function disableOverlay() {
            swipeOverlay.style.visibility = 'hidden';
            swipeBlocker.style.visibility = 'hidden';
            swipeBlocker.style.pointerEvents = 'none';
        }

        function onResize() {
            if(getOrientation() === 'landscape') {
                enableOverlay();
            } else {
                disableOverlay();
            }
        }

        function checkEndState() {
            if(window.innerHeight >= screen.width) {
                fullscreen = true;
                disableOverlay();
            } else {
                swipeOverlay.style.visibility = 'visible';

                if(fullscreen) {
                    enableOverlay();
                    fullscreen = false;
                }
            }
        }

        function checkScreenState() {
            if(getOrientation() === 'landscape') {
                checkEndState();
            } else {
                swipeOverlay.style.visibility = 'hidden';
            }
        }

        window.addEventListener('resize', onResize);
        window.setInterval(checkScreenState, 10);
        window.addEventListener('DOMContentLoaded', onResize);
    }
};

module.exports = iosFullscreen;

},{"./ios-fullscreen.css":3}],5:[function(require,module,exports){
module.exports = 'div.jurisdiction-se-links {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 24px;\n    text-align: center;\n    background-color: white;\n}\n\ndiv.jurisdiction-se-links img {\n    vertical-align: middle;\n    cursor: pointer;\n    height: 20px;\n    margin: 2px;\n}\n\ndiv.nolimit > div.keypad > div.topbar > div.clock {\n    position: absolute;\n    z-index: 2147483647;\n}\n';
},{}],6:[function(require,module,exports){
var BASE_URL = 'https://nolimitjs.nolimitcdn.com/img';
var SPELPAUS = BASE_URL + '/spelpaus.svg';
var SPELGRANSER = BASE_URL + '/spelgranser.svg';
var SJALVTEST = BASE_URL + '/sjalvtest.svg';

var spelpausUrl;
var spelgranserUrl;
var sjalvtestUrl;
var target;
var events;

function isLinks() {
    return !!(spelpausUrl && spelgranserUrl && sjalvtestUrl);
}

function isEvents() {
    return events === true;
}

function createListener(element, url, target, event, nolimitApi) {
    var links = isLinks();
    var events = isEvents();
    var urlCopy = '' + url;
    var targetCopy = '' + target;
    element.addEventListener('click', function() {
        if (links) {
            window.open(urlCopy, targetCopy);
        }
        if (events) {
            nolimitApi.trigger(event);
        }
    });
}

var jurisdictionSE = {
    init: function(options, document, nolimitApi) {
        console.log('sweden links', options.jurisdiction, isLinks(), isEvents());
        if (options.jurisdiction && options.jurisdiction.name === 'SE' && (isLinks() || isEvents())) {
            var style = document.createElement('style');
            document.head.appendChild(style);
            style.appendChild(document.createTextNode(require('./jurisdiction-se.css')));
            var linkHolder = document.createElement('div');
            linkHolder.classList.add('jurisdiction-se-links');

            var spelpausImg = document.createElement('img');
            spelpausImg.src = SPELPAUS;
            linkHolder.appendChild(spelpausImg);
            createListener(spelpausImg, spelpausUrl, target, 'spelpaus', nolimitApi);

            var spelgranserImg = document.createElement('img');
            spelgranserImg.src = SPELGRANSER;
            linkHolder.appendChild(spelgranserImg);
            createListener(spelgranserImg, spelgranserUrl, target, 'spelgranser', nolimitApi);

            var sjalvtestImg = document.createElement('img');
            sjalvtestImg.src = SJALVTEST;
            linkHolder.appendChild(sjalvtestImg);
            createListener(sjalvtestImg, sjalvtestUrl, target, 'sjalvtest', nolimitApi);

            var plus18 = document.createElement('span');
            plus18.innerHTML = '+18';
            plus18.style.fontSize = '12px';
            linkHolder.appendChild(plus18);

            document.body.appendChild(linkHolder);

            //var container = document.body.querySelector('.nolimit.container');
            //if (container) {
            //    container.style.top = '24px';
            //}
        }
    },
    takeOptions: function(options) {
        if (options.jurisdiction && options.jurisdiction.name === 'SE') {
            spelpausUrl = options.jurisdiction.spelpaus;
            delete options.jurisdiction.spelpaus;
            spelgranserUrl = options.jurisdiction.spelgranser;
            delete options.jurisdiction.spelgranser;
            sjalvtestUrl = options.jurisdiction.sjalvtest;
            delete options.jurisdiction.sjalvtest;
            target = options.jurisdiction.target || '_top';
            delete options.jurisdiction.target;
            events = options.jurisdiction.events === true;
            delete options.jurisdiction.events;
        }
    }
};

module.exports = jurisdictionSE;

},{"./jurisdiction-se.css":5}],7:[function(require,module,exports){
var UAParser = require('ua-parser-js');
var uaParser = new UAParser();
var ua = uaParser.getResult();

var SESSION_KEY = 'nolimit.js.log.session';
var URL = 'https://gamelog.nolimitcity.com/';
var LATEST = 'nolimit-latest';
var CURRENT_SCRIPT = currentScript();

var session = handleSession();

var extras = {};
var storedEvents = [];

function currentScript() {
    try {
        var scripts = document.getElementsByTagName('script');
        var index = scripts.length - 1;
        var tag = scripts[index];

        return tag.src;
    } catch (e) {
        return '';
    }
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function handleSession() {
    var fromStorage = null;
    try {
        fromStorage = sessionStorage.getItem(SESSION_KEY);
    } catch (e) {
        console.error('Could not read session', e);
    }
    var toSave = fromStorage || uuidv4();
    try {
        sessionStorage.setItem(SESSION_KEY, toSave);
    } catch (e) {
        console.error('Could not save session', e);
    }
    return toSave;
}

function sendLog(event, data) {
    // eslint-disable-next-line no-warning-comments
    // TODO: temp safety measure
    if(CURRENT_SCRIPT.indexOf(LATEST) === -1) {
        return;
    }

    if(extras.environment === 'test') {
        return;
    }

    data = data || {};
    var request = new XMLHttpRequest();
    request.open('POST', URL, true);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onload = function() {
        if(request.status >= 200 && request.status < 400) {
            try {
                var response = JSON.parse(request.responseText);
                console.log('Logger response:', response);
            } catch(e) {
                console.warn('Failed to send log:', e.message, event, data, e);
            }
        } else {
            console.warn('Error from server:', request.status, request.statusText, event, data);
        }
    };

    request.onerror = function() {
        console.warn('Logger error:', request.status, request.statusText, event, data);
    };

    var device = uaParser.getDevice();
    var body = {
        event: event,
        session: session,
        browser: ua.browser.name + ' ' + ua.browser.version,
        os: ua.os.name + ' ' + ua.os.version,
        vendor: device.vendor,
        model: device.model,
        history: storedEvents.slice(-10),
        deltaTime: Date.now() - extras.startTime
    };

    for(var name in extras) {
        body[name] = extras[name];
    }

    var key = uuidv4();
    body.data = data;

    var payload = {key: key, body: body};

    console.log('Logging payload:', payload);

    request.send(JSON.stringify(payload));
}

var errorAlreadySent = false;
var logHandler = {
    sendError: function(e) {
        if(errorAlreadySent) {
            console.log('Already sent errors, but was', e);
            return;
        }

        errorAlreadySent = true;

        var message = e.message || e;

        if(message === 'Script error.') {
            return;
        }

        if(e.code) {
            message = message + ' (' + e.code + ')';
        }

        if(e.filename && e.lineno) {
            message = message + ' @ ' + e.filename + ' line:' + e.lineno;
        }

        var data = {
            message: message
        };

        this.sendLog('ERROR', data);
    },

    sendLog: sendLog,

    setExtra: function(name, extra) {
        extras[name] = extra;
    },

    setExtras: function(extras) {
        for(var name in extras) {
            this.setExtra(name, extras[name]);
        }
    },

    storeEvent: function(name, data) {
        var event = {
            name: data,
            timestamp: Date.now()
        };
        storedEvents.push(event);
    },

    getEvents: function(filter) {
        if(filter) {
            return storedEvents.filter(function(event) {
                return event.name === filter;
            });
        }
        return storedEvents;
    }
};

window.addEventListener('error', onWindowError);

function onWindowError(e) {
    window.removeEventListener('error', onWindowError);
    console.warn(e.message, e);
    logHandler.sendError(e);
}

module.exports = logHandler;

},{"ua-parser-js":1}],8:[function(require,module,exports){
/**
 * @exports nolimitApiFactory
 * @private
 */
var nolimitApiFactory = function(target, onload) {

    var listeners = {};
    var unhandledEvents = {};
    var unhandledCalls = [];
    var port;

    function handleUnhandledCalls(port) {
        while(unhandledCalls.length > 0) {
            port.postMessage(unhandledCalls.shift());
        }
    }

    function addMessageListener(gameWindow) {
        gameWindow.addEventListener('message', function(e) {
            if(e.ports && e.ports.length > 0) {
                port = e.ports[0];
                port.onmessage = onMessage;
                handleUnhandledCalls(port);
            }
        });
        gameWindow.trigger = trigger;
        gameWindow.on = on;
        onload();
    }

    if(target.nodeName === 'IFRAME') {
        if (target.contentWindow && target.contentWindow.document && target.contentWindow.document.readyState === 'complete') {
            addMessageListener(target.contentWindow);
        } else {
            target.addEventListener('load', function() {
                addMessageListener(target.contentWindow);
            });
        }
    } else {
        addMessageListener(target);
    }

    function onMessage(e) {
        trigger(e.data.method, e.data.params);
    }

    function sendMessage(method, data) {
        var message = {
            jsonrpc: '2.0',
            method: method
        };

        if(data) {
            message.params = data;
        }

        if(port) {
            try {
                port.postMessage(message);
            } catch(ignored) {
                port = undefined;
                unhandledCalls.push(message);
            }
        } else {
            unhandledCalls.push(message);
        }
    }

    function registerEvents(events) {
        sendMessage('register', events);
    }

    function trigger(event, data) {
        if(listeners[event]) {
            listeners[event].forEach(function(callback) {
                callback(data);
            });
        } else {
            unhandledEvents[name] = unhandledEvents[name] || [];
            unhandledEvents[name].push(data);
        }
    }

    function on(event, callback) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(callback);
        while(unhandledEvents[event] && unhandledEvents[event].length > 0) {
            trigger(event, unhandledEvents[event].pop());
        }

        registerEvents([event]);
    }

    /**
     * Connection to the game using MessageChannel
     * @exports nolimitApi
     */
    var nolimitApi = {
        /**
         * Add listener for event from the started game
         *
         * @function on
         * @param {String}   event    name of the event
         * @param {Function} callback callback for the event, see specific event documentation for any parameters
         *
         * @example
         * api.on('deposit', function openDeposit () {
         *     showDeposit().then(function() {
         *         // ask the game to refresh balance from server
         *         api.call('refresh');
         *     });
         * });
         */
        on: on,

        /**
         * Call method in the open game
         *
         * @function call
         * @param {String} method name of the method to call
         * @param {Object} [data] optional data for the method called, if any
         *
         * @example
         * // reload the game
         * api.call('reload');
         */
        call: sendMessage,

        /**
         * Triggers a named event
         *
         * @function trigger
         * @param {String} event  name of the event
         * @param {Object} [data] optional data for the event, if any
         */
        trigger: trigger
    };

    return nolimitApi;
};

module.exports = nolimitApiFactory;

},{}],9:[function(require,module,exports){
module.exports = 'html, body {\n    overflow: hidden;\n    margin: 0;\n    width: 100%;\n    height: 100%;\n}\n\nbody {\n    position: relative;\n}\n';
},{}],10:[function(require,module,exports){
var logHandler = require('./log-handler');
logHandler.setExtra('nolimit.js', '1.2.72');

var nolimitApiFactory = require('./nolimit-api');
var info = require('./info');
var iosFullscreen = require('./ios-fullscreen');
var jurisdictionSE = require('./jurisdiction-se');

var CDN = 'https://{ENV}';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}';
var REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
var GAMES_URL = '{CDN}/games';

var DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': '1.2.72'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.72',

    options: {},

    /**
     * Initialize loader with default parameters. Can be skipped if the parameters are included in the call to load instead.
     *
     * @param {Object}  options
     * @param {String}  options.operator the operator code for the operator
     * @param {String}  [options.language="en"] the language to use for the game
     * @param {String}  [options.device=desktop] type of device: 'desktop' or 'mobile'. Recommended to always set this to make sure the correct device is used.
     * @param {String}  [options.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
     * @param {Boolean} [options.fullscreen=true] set to false to disable automatic fullscreen on mobile (Android only)
     * @param {Boolean} [options.clock=true] set to false to disable in-game clock
     * @param {String}  [options.quality] force asset quality. Possible values are 'high', 'medium', 'low'. Defaults to smart loading in each game.
     * @param {Object}  [options.jurisdiction] force a specific jurisdiction to enforce specific license requirements and set specific options and overrides. See README for jurisdiction-specific details.
     * @param {Object}  [options.jurisdiction.name] the name of the jurisdiction, for example "MT", "DK", "LV", "RO", "UKGC", "PT", "ES", "IT" or "SE".
     * @param {Object}  [options.realityCheck] set options for reality check. See README for more details.
     * @param {Object}  [options.realityCheck.enabled=true] set to false to disable reality-check dialog.
     * @param {Number}  [options.realityCheck.interval=60] Interval in minutes between showing reality-check dialog.
     * @param {Number}  [options.realityCheck.sessionStart=Date.now()] override session start, default is Date.now().
     * @param {Number}  [options.realityCheck.nextTime] next time to show dialog, defaults to Date.now() + interval.
     * @param {Number}  [options.realityCheck.bets=0] set initial bets if player already has bets in the session.
     * @param {Number}  [options.realityCheck.winnings=0] set initial winnings if player already has winnings in the session.
     * @param {Number}  [options.realityCheck.message] Message to display when dialog is opened. A generic default is provided.
     * @param {String}  [options.playForFunCurrency=EUR] currency to use when in playing for fun mode. Uses EUR if not specified.
     * @param {Boolean} [options.autoplay=true] set to false to disable and remove the auto play button.
     *
     * @example
     * nolimit.init({
     *    operator: 'SMOOTHOPERATOR',
     *    language: 'sv',
     *    device: 'mobile',
     *    environment: 'partner',
     *    currency: 'SEK',
     *    jurisdiction: {
     *        name: 'SE'
     *    },
     *    realityCheck: {
     *        interval: 30
     *    }
     * });
     */
    init: function(options) {
        this.options = options;
        logHandlerOptions(options);
    },

    /**
     * Load game, replacing target with the game.
     *
     * <li> If target is a HTML element, it will be replaced with an iframe, keeping all the attributes of the original element, so those can be used to set id, classes, styles and more.
     * <li> If target is a Window element, the game will be loaded directly in that.
     * <li> If target is undefined, it will default to the current window.
     *
     * @param {Object}              options
     * @param {String}              options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
     * @param {HTMLElement|Window}  [options.target=window] the HTMLElement or Window to load the game in
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     * @param {Boolean}             [options.hideCurrency] hide currency symbols/codes in the game
     *
     * @returns {nolimitApi}        The API connection to the opened game.
     *
     * @example
     * var api = nolimit.load({
     *    game: 'DragonTribe',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    load: function(options) {
        options = processOptions(mergeOptions(this.options, options));
        logHandlerOptions(options);
        jurisdictionSE.takeOptions(options);

        startLoadLog();

        var target = options.target || window;

        if(target.Window && target instanceof target.Window) {
            target = document.createElement('div');
            target.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden;');
            document.body.appendChild(target);
        }

        if(target.ownerDocument && target instanceof target.ownerDocument.defaultView.HTMLElement) {
            var iframe = makeIframe(target);
            target.parentNode.replaceChild(iframe, target);

            var nolimitApi = nolimitApiFactory(iframe, function() {
                html(iframe.contentWindow, options);
                iframe.contentWindow.addEventListener('error', function(e) {
                    logHandler.sendError(e);
                });
            });

            nolimitApi.on('external', function(external) {
                if(external.name === 'halt') {
                    var betEvents = logHandler.getEvents('bet');
                    console.log('nolimit.js halt', betEvents);
                    if(betEvents.length === 0) {
                        logHandler.sendLog('NO_BETS_PLACED', {message: 'Game closed with no bets'});
                    }
                }
                if(external.name ==='bet') {
                    logHandler.storeEvent('bet', external.data);
                }
                if(external.name ==='ready') {
                    logHandler.setExtra('loadTime', Date.now() - startTime);
                }
            });

            nolimitApi.on('intro', function() {
                iosFullscreen.init(options, iframe.contentWindow.document);
            });

            nolimitApi.on('intro', function() {
                jurisdictionSE.init(options, iframe.contentWindow.document, nolimitApi);
            });

            return nolimitApi;
        } else {
            throw 'Invalid option target: ' + target;
        }
    },

    /**
     * Load game in a new, separate page. This offers the best isolation, but no communication with the game is possible.
     *
     * @param {Object}              options
     * @param {String}              options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     * @param {Boolean}             [options.hideCurrency] hide currency symbols/codes in the game
     * @param {String}              [options.lobbyUrl="history:back()"] URL to redirect back to lobby on mobile, if not using a target
     * @param {String}              [options.depositUrl] URL to deposit page, if not using a target element
     * @param {String}              [options.supportUrl] URL to support page, if not using a target element
     * @param {Boolean}             [options.depositEvent] instead of using URL, emit "deposit" event (see event documentation)
     * @param {Boolean}             [options.lobbyEvent] instead of using URL, emit "lobby" event (see event documentation) (mobile only)
     * @param {String}              [options.accountHistoryUrl] URL to support page, if not using a target element
     *
     * @example
     * var api = nolimit.replace({
     *    game: 'DragonTribe',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    replace: function(options) {
        logHandlerOptions(options);
        startLoadLog();
        location.href = this.url(options);

        function noop() {
        }

        return {on: noop, call: noop};
    },

    /**
     * Constructs a URL for manually loading the game in an iframe or via redirect.

     * @param {Object} options see replace for details
     * @see {@link nolimit.replace} for details on options
     * @return {string}
     */
    url: function(options) {
        var gameOptions = processOptions(mergeOptions(this.options, options));
        logHandlerOptions(gameOptions);
        var gameUrl = REPLACE_URL
            .replace('{CDN}', gameOptions.cdn)
            .replace('{QUERY}', makeQueryString(gameOptions));
        return gameUrl;
    },

    /**
     * Load information about the game, such as: current version, preferred width/height etc.
     *
     * @param {Object}      options
     * @param {String}      [options.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
     * @param {String}      options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
     * @param {String}      [options.version] force specific version of game to load.
     * @param {Function}    callback  called with the info object, if there was an error, the 'error' field will be set
     *
     * @example
     * nolimit.info({game: 'DragonTribe'}, function(info) {
     *     var target = document.getElementById('game');
     *     target.style.width = info.size.width + 'px';
     *     target.style.height = info.size.height + 'px';
     *     console.log(info.name, info.version);
     * });
     */
    info: function(options, callback) {
        options = processOptions(mergeOptions(this.options, options));
        logHandlerOptions(options);
        info.load(options, callback);
    }
};

function logHandlerOptions(options) {
    logHandler.setExtras({
        operator: options.operator,
        device: options.device,
        token: options.token,
        game: options.game,
        environment: options.environment
    });
}

var startTime;
function startLoadLog() {
    startTime = Date.now();
}

function makeQueryString(options) {
    var query = [];
    for(var key in options) {
        var value = options[key];
        if(typeof value === 'undefined') {
            continue;
        }
        if(value instanceof HTMLElement) {
            continue;
        }
        if(typeof value === 'object') {
            value = JSON.stringify(value);
        }
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
    return query.join('&');
}

function makeIframe(element) {
    var iframe = document.createElement('iframe');
    copyAttributes(element, iframe);

    iframe.setAttribute('frameBorder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups');

    var name = generateName(iframe.getAttribute('name') || iframe.id);
    iframe.setAttribute('name', name);

    return iframe;
}

function mergeOptions(globalOptions, gameOptions) {
    delete globalOptions.version;
    delete globalOptions.replay;
    delete globalOptions.token;
    var options = {}, name;
    for(name in DEFAULT_OPTIONS) {
        options[name] = DEFAULT_OPTIONS[name];
    }
    for(name in globalOptions) {
        options[name] = globalOptions[name];
    }
    for(name in gameOptions) {
        options[name] = gameOptions[name];
    }
    return options;
}

function insertCss(document) {
    var style = document.createElement('style');
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(require('./nolimit.css')));
}

function setupViewport(head) {
    var viewport = head.querySelector('meta[name="viewport"]');
    if(!viewport) {
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
    }
}

function processOptions(options) {
    options.device = options.device.toLowerCase();
    options.mute = options.mute || false;
    var environment = options.environment.toLowerCase();
    if(environment.indexOf('.') === -1) {
        environment += '.nolimitcdn.com';
    }
    options.cdn = options.cdn || CDN.replace('{ENV}', environment);
    options.staticRoot = options.staticRoot || GAMES_URL.replace('{CDN}', options.cdn);
    options.playForFunCurrency = options.playForFunCurrency || options.currency;
    if (options.language === 'pe' || options.language === 'cl') {
        options.language = 'es';
    }
    return options;
}

function html(window, options) {
    var document = window.document;

    window.focus();

    insertCss(document);
    setupViewport(document.head);

    var loaderElement = document.createElement('iframe');
    loaderElement.setAttribute('frameBorder', '0');
    loaderElement.style.backgroundColor = 'black';
    loaderElement.style.width = '100vw';
    loaderElement.style.height = '100vh';
    loaderElement.style.position = 'relative';
    loaderElement.style.zIndex = '2147483647';
    loaderElement.classList.add('loader');

    loaderElement.src = LOADER_URL
        .replace('{CDN}', options.cdn)
        .replace('{DEVICE}', options.device)
        .replace('{OPERATOR}', options.operator)
        .replace('{GAME}', options.game)
        .replace('{LANGUAGE}', options.language);

    document.body.innerHTML = '';

    loaderElement.onload = function() {
        window.on('error', function(error) {
            logHandler.sendError(error);
            if(loaderElement && loaderElement.contentWindow) {
                loaderElement.contentWindow.postMessage(JSON.stringify({'error': error}), '*');
            }
        });

        nolimit.info(options, function(info) {
            if(info.error) {
                window.trigger('error', info.error);
                loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
            } else {
                window.trigger('info', info);

                var gameElement = document.createElement('script');
                gameElement.src = info.staticRoot + '/game.js';

                options.loadStart = Date.now();
                window.nolimit = nolimit;
                window.nolimit.options = options;
                window.nolimit.options.version = info.version;

                document.body.appendChild(gameElement);
            }
        });

        loaderElement.onload = function() {
        };
    };

    document.body.appendChild(loaderElement);
}

function copyAttributes(from, to) {
    var attributes = from.attributes;
    for(var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        to.setAttribute(attr.name, attr.value);
    }
}

var generateName = (function() {
    var generatedIndex = 1;
    return function(name) {
        return name || 'Nolimit-' + generatedIndex++;
    };
})();

module.exports = nolimit;

},{"./info":2,"./ios-fullscreen":4,"./jurisdiction-se":6,"./log-handler":7,"./nolimit-api":8,"./nolimit.css":9}]},{},[10])(10)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvdWEtcGFyc2VyLWpzL3NyYy91YS1wYXJzZXIuanMiLCJzcmMvaW5mby5qcyIsInNyYy9pb3MtZnVsbHNjcmVlbi5jc3MiLCJzcmMvaW9zLWZ1bGxzY3JlZW4uanMiLCJzcmMvanVyaXNkaWN0aW9uLXNlLmNzcyIsInNyYy9qdXJpc2RpY3Rpb24tc2UuanMiLCJzcmMvbG9nLWhhbmRsZXIuanMiLCJzcmMvbm9saW1pdC1hcGkuanMiLCJzcmMvbm9saW1pdC5jc3MiLCJzcmMvbm9saW1pdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoNEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKiFcbiAqIFVBUGFyc2VyLmpzIHYwLjcuMjBcbiAqIExpZ2h0d2VpZ2h0IEphdmFTY3JpcHQtYmFzZWQgVXNlci1BZ2VudCBzdHJpbmcgcGFyc2VyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vZmFpc2FsbWFuL3VhLXBhcnNlci1qc1xuICpcbiAqIENvcHlyaWdodCDCqSAyMDEyLTIwMTkgRmFpc2FsIFNhbG1hbiA8ZkBmYWlzYWxtYW4uY29tPlxuICogTGljZW5zZWQgdW5kZXIgTUlUIExpY2Vuc2VcbiAqL1xuXG4oZnVuY3Rpb24gKHdpbmRvdywgdW5kZWZpbmVkKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLy8vLy8vLy8vLy8vL1xuICAgIC8vIENvbnN0YW50c1xuICAgIC8vLy8vLy8vLy8vLy9cblxuXG4gICAgdmFyIExJQlZFUlNJT04gID0gJzAuNy4yMCcsXG4gICAgICAgIEVNUFRZICAgICAgID0gJycsXG4gICAgICAgIFVOS05PV04gICAgID0gJz8nLFxuICAgICAgICBGVU5DX1RZUEUgICA9ICdmdW5jdGlvbicsXG4gICAgICAgIFVOREVGX1RZUEUgID0gJ3VuZGVmaW5lZCcsXG4gICAgICAgIE9CSl9UWVBFICAgID0gJ29iamVjdCcsXG4gICAgICAgIFNUUl9UWVBFICAgID0gJ3N0cmluZycsXG4gICAgICAgIE1BSk9SICAgICAgID0gJ21ham9yJywgLy8gZGVwcmVjYXRlZFxuICAgICAgICBNT0RFTCAgICAgICA9ICdtb2RlbCcsXG4gICAgICAgIE5BTUUgICAgICAgID0gJ25hbWUnLFxuICAgICAgICBUWVBFICAgICAgICA9ICd0eXBlJyxcbiAgICAgICAgVkVORE9SICAgICAgPSAndmVuZG9yJyxcbiAgICAgICAgVkVSU0lPTiAgICAgPSAndmVyc2lvbicsXG4gICAgICAgIEFSQ0hJVEVDVFVSRT0gJ2FyY2hpdGVjdHVyZScsXG4gICAgICAgIENPTlNPTEUgICAgID0gJ2NvbnNvbGUnLFxuICAgICAgICBNT0JJTEUgICAgICA9ICdtb2JpbGUnLFxuICAgICAgICBUQUJMRVQgICAgICA9ICd0YWJsZXQnLFxuICAgICAgICBTTUFSVFRWICAgICA9ICdzbWFydHR2JyxcbiAgICAgICAgV0VBUkFCTEUgICAgPSAnd2VhcmFibGUnLFxuICAgICAgICBFTUJFRERFRCAgICA9ICdlbWJlZGRlZCc7XG5cblxuICAgIC8vLy8vLy8vLy8vXG4gICAgLy8gSGVscGVyXG4gICAgLy8vLy8vLy8vL1xuXG5cbiAgICB2YXIgdXRpbCA9IHtcbiAgICAgICAgZXh0ZW5kIDogZnVuY3Rpb24gKHJlZ2V4ZXMsIGV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIHZhciBtZXJnZWRSZWdleGVzID0ge307XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIHJlZ2V4ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uc1tpXSAmJiBleHRlbnNpb25zW2ldLmxlbmd0aCAlIDIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbWVyZ2VkUmVnZXhlc1tpXSA9IGV4dGVuc2lvbnNbaV0uY29uY2F0KHJlZ2V4ZXNbaV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lcmdlZFJlZ2V4ZXNbaV0gPSByZWdleGVzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtZXJnZWRSZWdleGVzO1xuICAgICAgICB9LFxuICAgICAgICBoYXMgOiBmdW5jdGlvbiAoc3RyMSwgc3RyMikge1xuICAgICAgICAgIGlmICh0eXBlb2Ygc3RyMSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgcmV0dXJuIHN0cjIudG9Mb3dlckNhc2UoKS5pbmRleE9mKHN0cjEudG9Mb3dlckNhc2UoKSkgIT09IC0xO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb3dlcml6ZSA6IGZ1bmN0aW9uIChzdHIpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfSxcbiAgICAgICAgbWFqb3IgOiBmdW5jdGlvbiAodmVyc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZih2ZXJzaW9uKSA9PT0gU1RSX1RZUEUgPyB2ZXJzaW9uLnJlcGxhY2UoL1teXFxkXFwuXS9nLCcnKS5zcGxpdChcIi5cIilbMF0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaW0gOiBmdW5jdGlvbiAoc3RyKSB7XG4gICAgICAgICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eW1xcc1xcdUZFRkZcXHhBMF0rfFtcXHNcXHVGRUZGXFx4QTBdKyQvZywgJycpO1xuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gTWFwIGhlbHBlclxuICAgIC8vLy8vLy8vLy8vLy8vXG5cblxuICAgIHZhciBtYXBwZXIgPSB7XG5cbiAgICAgICAgcmd4IDogZnVuY3Rpb24gKHVhLCBhcnJheXMpIHtcblxuICAgICAgICAgICAgdmFyIGkgPSAwLCBqLCBrLCBwLCBxLCBtYXRjaGVzLCBtYXRjaDtcblxuICAgICAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCByZWdleGVzIG1hcHNcbiAgICAgICAgICAgIHdoaWxlIChpIDwgYXJyYXlzLmxlbmd0aCAmJiAhbWF0Y2hlcykge1xuXG4gICAgICAgICAgICAgICAgdmFyIHJlZ2V4ID0gYXJyYXlzW2ldLCAgICAgICAvLyBldmVuIHNlcXVlbmNlICgwLDIsNCwuLilcbiAgICAgICAgICAgICAgICAgICAgcHJvcHMgPSBhcnJheXNbaSArIDFdOyAgIC8vIG9kZCBzZXF1ZW5jZSAoMSwzLDUsLi4pXG4gICAgICAgICAgICAgICAgaiA9IGsgPSAwO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJ5IG1hdGNoaW5nIHVhc3RyaW5nIHdpdGggcmVnZXhlc1xuICAgICAgICAgICAgICAgIHdoaWxlIChqIDwgcmVnZXgubGVuZ3RoICYmICFtYXRjaGVzKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyA9IHJlZ2V4W2orK10uZXhlYyh1YSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEhbWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChwID0gMDsgcCA8IHByb3BzLmxlbmd0aDsgcCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBtYXRjaGVzWysra107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcSA9IHByb3BzW3BdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGdpdmVuIHByb3BlcnR5IGlzIGFjdHVhbGx5IGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBxID09PSBPQkpfVFlQRSAmJiBxLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHEubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcVsxXSA9PSBGVU5DX1RZUEUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gbW9kaWZpZWQgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3FbMF1dID0gcVsxXS5jYWxsKHRoaXMsIG1hdGNoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIGdpdmVuIHZhbHVlLCBpZ25vcmUgcmVnZXggbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3FbMF1dID0gcVsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChxLmxlbmd0aCA9PSAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjaGVjayB3aGV0aGVyIGZ1bmN0aW9uIG9yIHJlZ2V4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHFbMV0gPT09IEZVTkNfVFlQRSAmJiAhKHFbMV0uZXhlYyAmJiBxWzFdLnRlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FsbCBmdW5jdGlvbiAodXN1YWxseSBzdHJpbmcgbWFwcGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbcVswXV0gPSBtYXRjaCA/IHFbMV0uY2FsbCh0aGlzLCBtYXRjaCwgcVsyXSkgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNhbml0aXplIG1hdGNoIHVzaW5nIGdpdmVuIHJlZ2V4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1txWzBdXSA9IG1hdGNoID8gbWF0Y2gucmVwbGFjZShxWzFdLCBxWzJdKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChxLmxlbmd0aCA9PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1txWzBdXSA9IG1hdGNoID8gcVszXS5jYWxsKHRoaXMsIG1hdGNoLnJlcGxhY2UocVsxXSwgcVsyXSkpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1txXSA9IG1hdGNoID8gbWF0Y2ggOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGkgKz0gMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBzdHIgOiBmdW5jdGlvbiAoc3RyLCBtYXApIHtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBtYXApIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBhcnJheVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWFwW2ldID09PSBPQkpfVFlQRSAmJiBtYXBbaV0ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1hcFtpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaGFzKG1hcFtpXVtqXSwgc3RyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoaSA9PT0gVU5LTk9XTikgPyB1bmRlZmluZWQgOiBpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh1dGlsLmhhcyhtYXBbaV0sIHN0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChpID09PSBVTktOT1dOKSA/IHVuZGVmaW5lZCA6IGk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIC8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIFN0cmluZyBtYXBcbiAgICAvLy8vLy8vLy8vLy8vL1xuXG5cbiAgICB2YXIgbWFwcyA9IHtcblxuICAgICAgICBicm93c2VyIDoge1xuICAgICAgICAgICAgb2xkc2FmYXJpIDoge1xuICAgICAgICAgICAgICAgIHZlcnNpb24gOiB7XG4gICAgICAgICAgICAgICAgICAgICcxLjAnICAgOiAnLzgnLFxuICAgICAgICAgICAgICAgICAgICAnMS4yJyAgIDogJy8xJyxcbiAgICAgICAgICAgICAgICAgICAgJzEuMycgICA6ICcvMycsXG4gICAgICAgICAgICAgICAgICAgICcyLjAnICAgOiAnLzQxMicsXG4gICAgICAgICAgICAgICAgICAgICcyLjAuMicgOiAnLzQxNicsXG4gICAgICAgICAgICAgICAgICAgICcyLjAuMycgOiAnLzQxNycsXG4gICAgICAgICAgICAgICAgICAgICcyLjAuNCcgOiAnLzQxOScsXG4gICAgICAgICAgICAgICAgICAgICc/JyAgICAgOiAnLydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgZGV2aWNlIDoge1xuICAgICAgICAgICAgYW1hem9uIDoge1xuICAgICAgICAgICAgICAgIG1vZGVsIDoge1xuICAgICAgICAgICAgICAgICAgICAnRmlyZSBQaG9uZScgOiBbJ1NEJywgJ0tGJ11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3ByaW50IDoge1xuICAgICAgICAgICAgICAgIG1vZGVsIDoge1xuICAgICAgICAgICAgICAgICAgICAnRXZvIFNoaWZ0IDRHJyA6ICc3MzczS1QnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB2ZW5kb3IgOiB7XG4gICAgICAgICAgICAgICAgICAgICdIVEMnICAgICAgIDogJ0FQQScsXG4gICAgICAgICAgICAgICAgICAgICdTcHJpbnQnICAgIDogJ1NwcmludCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgb3MgOiB7XG4gICAgICAgICAgICB3aW5kb3dzIDoge1xuICAgICAgICAgICAgICAgIHZlcnNpb24gOiB7XG4gICAgICAgICAgICAgICAgICAgICdNRScgICAgICAgIDogJzQuOTAnLFxuICAgICAgICAgICAgICAgICAgICAnTlQgMy4xMScgICA6ICdOVDMuNTEnLFxuICAgICAgICAgICAgICAgICAgICAnTlQgNC4wJyAgICA6ICdOVDQuMCcsXG4gICAgICAgICAgICAgICAgICAgICcyMDAwJyAgICAgIDogJ05UIDUuMCcsXG4gICAgICAgICAgICAgICAgICAgICdYUCcgICAgICAgIDogWydOVCA1LjEnLCAnTlQgNS4yJ10sXG4gICAgICAgICAgICAgICAgICAgICdWaXN0YScgICAgIDogJ05UIDYuMCcsXG4gICAgICAgICAgICAgICAgICAgICc3JyAgICAgICAgIDogJ05UIDYuMScsXG4gICAgICAgICAgICAgICAgICAgICc4JyAgICAgICAgIDogJ05UIDYuMicsXG4gICAgICAgICAgICAgICAgICAgICc4LjEnICAgICAgIDogJ05UIDYuMycsXG4gICAgICAgICAgICAgICAgICAgICcxMCcgICAgICAgIDogWydOVCA2LjQnLCAnTlQgMTAuMCddLFxuICAgICAgICAgICAgICAgICAgICAnUlQnICAgICAgICA6ICdBUk0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBSZWdleCBtYXBcbiAgICAvLy8vLy8vLy8vLy8vXG5cblxuICAgIHZhciByZWdleGVzID0ge1xuXG4gICAgICAgIGJyb3dzZXIgOiBbW1xuXG4gICAgICAgICAgICAvLyBQcmVzdG8gYmFzZWRcbiAgICAgICAgICAgIC8ob3BlcmFcXHNtaW5pKVxcLyhbXFx3XFwuLV0rKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIE1pbmlcbiAgICAgICAgICAgIC8ob3BlcmFcXHNbbW9iaWxldGFiXSspLit2ZXJzaW9uXFwvKFtcXHdcXC4tXSspL2ksICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIE1vYmkvVGFibGV0XG4gICAgICAgICAgICAvKG9wZXJhKS4rdmVyc2lvblxcLyhbXFx3XFwuXSspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhID4gOS44MFxuICAgICAgICAgICAgLyhvcGVyYSlbXFwvXFxzXSsoW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgPCA5LjgwXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhvcGlvcylbXFwvXFxzXSsoW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgbWluaSBvbiBpcGhvbmUgPj0gOC4wXG4gICAgICAgICAgICBdLCBbW05BTUUsICdPcGVyYSBNaW5pJ10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC9cXHMob3ByKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIFdlYmtpdFxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnT3BlcmEnXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLy8gTWl4ZWRcbiAgICAgICAgICAgIC8oa2luZGxlKVxcLyhbXFx3XFwuXSspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gS2luZGxlXG4gICAgICAgICAgICAvKGx1bmFzY2FwZXxtYXh0aG9ufG5ldGZyb250fGphc21pbmV8YmxhemVyKVtcXC9cXHNdPyhbXFx3XFwuXSopL2ksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEx1bmFzY2FwZS9NYXh0aG9uL05ldGZyb250L0phc21pbmUvQmxhemVyXG5cbiAgICAgICAgICAgIC8vIFRyaWRlbnQgYmFzZWRcbiAgICAgICAgICAgIC8oYXZhbnRcXHN8aWVtb2JpbGV8c2xpbXxiYWlkdSkoPzpicm93c2VyKT9bXFwvXFxzXT8oW1xcd1xcLl0qKS9pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBdmFudC9JRU1vYmlsZS9TbGltQnJvd3Nlci9CYWlkdVxuICAgICAgICAgICAgLyg/Om1zfFxcKCkoaWUpXFxzKFtcXHdcXC5dKykvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSW50ZXJuZXQgRXhwbG9yZXJcblxuICAgICAgICAgICAgLy8gV2Via2l0L0tIVE1MIGJhc2VkXG4gICAgICAgICAgICAvKHJla29ucSlcXC8oW1xcd1xcLl0qKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJla29ucVxuICAgICAgICAgICAgLyhjaHJvbWl1bXxmbG9ja3xyb2NrbWVsdHxtaWRvcml8ZXBpcGhhbnl8c2lsa3xza3lmaXJlfG92aWJyb3dzZXJ8Ym9sdHxpcm9ufHZpdmFsZGl8aXJpZGl1bXxwaGFudG9tanN8Ym93c2VyfHF1YXJrfHF1cHppbGxhfGZhbGtvbilcXC8oW1xcd1xcLi1dKykvaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaHJvbWl1bS9GbG9jay9Sb2NrTWVsdC9NaWRvcmkvRXBpcGhhbnkvU2lsay9Ta3lmaXJlL0JvbHQvSXJvbi9JcmlkaXVtL1BoYW50b21KUy9Cb3dzZXIvUXVwWmlsbGEvRmFsa29uXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhrb25xdWVyb3IpXFwvKFtcXHdcXC5dKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBLb25xdWVyb3JcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ0tvbnF1ZXJvciddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKHRyaWRlbnQpLitydls6XFxzXShbXFx3XFwuXSspLitsaWtlXFxzZ2Vja28vaSAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJRTExXG4gICAgICAgICAgICBdLCBbW05BTUUsICdJRSddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKGVkZ2V8ZWRnaW9zfGVkZ2F8ZWRnKVxcLygoXFxkKyk/W1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNaWNyb3NvZnQgRWRnZVxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnRWRnZSddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKHlhYnJvd3NlcilcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFlhbmRleFxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnWWFuZGV4J10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8ocHVmZmluKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHVmZmluXG4gICAgICAgICAgICBdLCBbW05BTUUsICdQdWZmaW4nXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhmb2N1cylcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJlZm94IEZvY3VzXG4gICAgICAgICAgICBdLCBbW05BTUUsICdGaXJlZm94IEZvY3VzJ10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8ob3B0KVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgVG91Y2hcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ09wZXJhIFRvdWNoJ10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8oKD86W1xcc1xcL10pdWM/XFxzP2Jyb3dzZXJ8KD86anVjLispdWN3ZWIpW1xcL1xcc10/KFtcXHdcXC5dKykvaSAgICAgICAgIC8vIFVDQnJvd3NlclxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnVUNCcm93c2VyJ10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8oY29tb2RvX2RyYWdvbilcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29tb2RvIERyYWdvblxuICAgICAgICAgICAgXSwgW1tOQU1FLCAvXy9nLCAnICddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKHdpbmRvd3N3ZWNoYXQgcWJjb3JlKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlQ2hhdCBEZXNrdG9wIGZvciBXaW5kb3dzIEJ1aWx0LWluIEJyb3dzZXJcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ1dlQ2hhdChXaW4pIERlc2t0b3AnXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhtaWNyb21lc3NlbmdlcilcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXZUNoYXRcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ1dlQ2hhdCddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKGJyYXZlKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQnJhdmUgYnJvd3NlclxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnQnJhdmUnXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhxcWJyb3dzZXJsaXRlKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBRUUJyb3dzZXJMaXRlXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhRUSlcXC8oW1xcZFxcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBRUSwgYWthIFNob3VRXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgL20/KHFxYnJvd3NlcilbXFwvXFxzXT8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUVFCcm93c2VyXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhCSURVQnJvd3NlcilbXFwvXFxzXT8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQmFpZHUgQnJvd3NlclxuICAgICAgICAgICAgXSwgW05BTUUsIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8oMjM0NUV4cGxvcmVyKVtcXC9cXHNdPyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDIzNDUgQnJvd3NlclxuICAgICAgICAgICAgXSwgW05BTUUsIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8oTWV0YVNyKVtcXC9cXHNdPyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNvdUdvdUJyb3dzZXJcbiAgICAgICAgICAgIF0sIFtOQU1FXSwgW1xuXG4gICAgICAgICAgICAvKExCQlJPV1NFUikvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGllQmFvIEJyb3dzZXJcbiAgICAgICAgICAgIF0sIFtOQU1FXSwgW1xuXG4gICAgICAgICAgICAveGlhb21pXFwvbWl1aWJyb3dzZXJcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNSVVJIEJyb3dzZXJcbiAgICAgICAgICAgIF0sIFtWRVJTSU9OLCBbTkFNRSwgJ01JVUkgQnJvd3NlciddXSwgW1xuXG4gICAgICAgICAgICAvO2ZiYXZcXC8oW1xcd1xcLl0rKTsvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhY2Vib29rIEFwcCBmb3IgaU9TICYgQW5kcm9pZFxuICAgICAgICAgICAgXSwgW1ZFUlNJT04sIFtOQU1FLCAnRmFjZWJvb2snXV0sIFtcblxuICAgICAgICAgICAgL3NhZmFyaVxccyhsaW5lKVxcLyhbXFx3XFwuXSspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGluZSBBcHAgZm9yIGlPU1xuICAgICAgICAgICAgL2FuZHJvaWQuKyhsaW5lKVxcLyhbXFx3XFwuXSspXFwvaWFiL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGluZSBBcHAgZm9yIEFuZHJvaWRcbiAgICAgICAgICAgIF0sIFtOQU1FLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvaGVhZGxlc3NjaHJvbWUoPzpcXC8oW1xcd1xcLl0rKXxcXHMpL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaHJvbWUgSGVhZGxlc3NcbiAgICAgICAgICAgIF0sIFtWRVJTSU9OLCBbTkFNRSwgJ0Nocm9tZSBIZWFkbGVzcyddXSwgW1xuXG4gICAgICAgICAgICAvXFxzd3ZcXCkuKyhjaHJvbWUpXFwvKFtcXHdcXC5dKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hyb21lIFdlYlZpZXdcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgLyguKykvLCAnJDEgV2ViVmlldyddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKCg/Om9jdWx1c3xzYW1zdW5nKWJyb3dzZXIpXFwvKFtcXHdcXC5dKykvaVxuICAgICAgICAgICAgXSwgW1tOQU1FLCAvKC4rKD86Z3x1cykpKC4rKS8sICckMSAkMiddLCBWRVJTSU9OXSwgWyAgICAgICAgICAgICAgICAvLyBPY3VsdXMgLyBTYW1zdW5nIEJyb3dzZXJcblxuICAgICAgICAgICAgL2FuZHJvaWQuK3ZlcnNpb25cXC8oW1xcd1xcLl0rKVxccysoPzptb2JpbGVcXHM/c2FmYXJpfHNhZmFyaSkqL2kgICAgICAgIC8vIEFuZHJvaWQgQnJvd3NlclxuICAgICAgICAgICAgXSwgW1ZFUlNJT04sIFtOQU1FLCAnQW5kcm9pZCBCcm93c2VyJ11dLCBbXG5cbiAgICAgICAgICAgIC8oc2FpbGZpc2hicm93c2VyKVxcLyhbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2FpbGZpc2ggQnJvd3NlclxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnU2FpbGZpc2ggQnJvd3NlciddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKGNocm9tZXxvbW5pd2VifGFyb3JhfFt0aXplbm9rYV17NX1cXHM/YnJvd3NlcilcXC92PyhbXFx3XFwuXSspL2lcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hyb21lL09tbmlXZWIvQXJvcmEvVGl6ZW4vTm9raWFcbiAgICAgICAgICAgIF0sIFtOQU1FLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvKGRvbGZpbilcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvbHBoaW5cbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ0RvbHBoaW4nXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLygoPzphbmRyb2lkLispY3Jtb3xjcmlvcylcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaHJvbWUgZm9yIEFuZHJvaWQvaU9TXG4gICAgICAgICAgICBdLCBbW05BTUUsICdDaHJvbWUnXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhjb2FzdClcXC8oW1xcd1xcLl0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPcGVyYSBDb2FzdFxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnT3BlcmEgQ29hc3QnXSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgL2Z4aW9zXFwvKFtcXHdcXC4tXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJlZm94IGZvciBpT1NcbiAgICAgICAgICAgIF0sIFtWRVJTSU9OLCBbTkFNRSwgJ0ZpcmVmb3gnXV0sIFtcblxuICAgICAgICAgICAgL3ZlcnNpb25cXC8oW1xcd1xcLl0rKS4rP21vYmlsZVxcL1xcdytcXHMoc2FmYXJpKS9pICAgICAgICAgICAgICAgICAgICAgICAvLyBNb2JpbGUgU2FmYXJpXG4gICAgICAgICAgICBdLCBbVkVSU0lPTiwgW05BTUUsICdNb2JpbGUgU2FmYXJpJ11dLCBbXG5cbiAgICAgICAgICAgIC92ZXJzaW9uXFwvKFtcXHdcXC5dKykuKz8obW9iaWxlXFxzP3NhZmFyaXxzYWZhcmkpL2kgICAgICAgICAgICAgICAgICAgIC8vIFNhZmFyaSAmIFNhZmFyaSBNb2JpbGVcbiAgICAgICAgICAgIF0sIFtWRVJTSU9OLCBOQU1FXSwgW1xuXG4gICAgICAgICAgICAvd2Via2l0Lis/KGdzYSlcXC8oW1xcd1xcLl0rKS4rPyhtb2JpbGVcXHM/c2FmYXJpfHNhZmFyaSkoXFwvW1xcd1xcLl0rKS9pICAvLyBHb29nbGUgU2VhcmNoIEFwcGxpYW5jZSBvbiBpT1NcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ0dTQSddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvd2Via2l0Lis/KG1vYmlsZVxccz9zYWZhcml8c2FmYXJpKShcXC9bXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAvLyBTYWZhcmkgPCAzLjBcbiAgICAgICAgICAgIF0sIFtOQU1FLCBbVkVSU0lPTiwgbWFwcGVyLnN0ciwgbWFwcy5icm93c2VyLm9sZHNhZmFyaS52ZXJzaW9uXV0sIFtcblxuICAgICAgICAgICAgLyh3ZWJraXR8a2h0bWwpXFwvKFtcXHdcXC5dKykvaVxuICAgICAgICAgICAgXSwgW05BTUUsIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8vIEdlY2tvIGJhc2VkXG4gICAgICAgICAgICAvKG5hdmlnYXRvcnxuZXRzY2FwZSlcXC8oW1xcd1xcLi1dKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5ldHNjYXBlXG4gICAgICAgICAgICBdLCBbW05BTUUsICdOZXRzY2FwZSddLCBWRVJTSU9OXSwgW1xuICAgICAgICAgICAgLyhzd2lmdGZveCkvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTd2lmdGZveFxuICAgICAgICAgICAgLyhpY2VkcmFnb258aWNld2Vhc2VsfGNhbWlub3xjaGltZXJhfGZlbm5lY3xtYWVtb1xcc2Jyb3dzZXJ8bWluaW1vfGNvbmtlcm9yKVtcXC9cXHNdPyhbXFx3XFwuXFwrXSspL2ksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEljZURyYWdvbi9JY2V3ZWFzZWwvQ2FtaW5vL0NoaW1lcmEvRmVubmVjL01hZW1vL01pbmltby9Db25rZXJvclxuICAgICAgICAgICAgLyhmaXJlZm94fHNlYW1vbmtleXxrLW1lbGVvbnxpY2VjYXR8aWNlYXBlfGZpcmViaXJkfHBob2VuaXh8cGFsZW1vb258YmFzaWxpc2t8d2F0ZXJmb3gpXFwvKFtcXHdcXC4tXSspJC9pLFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpcmVmb3gvU2VhTW9ua2V5L0stTWVsZW9uL0ljZUNhdC9JY2VBcGUvRmlyZWJpcmQvUGhvZW5peFxuICAgICAgICAgICAgLyhtb3ppbGxhKVxcLyhbXFx3XFwuXSspLitydlxcOi4rZ2Vja29cXC9cXGQrL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNb3ppbGxhXG5cbiAgICAgICAgICAgIC8vIE90aGVyXG4gICAgICAgICAgICAvKHBvbGFyaXN8bHlueHxkaWxsb3xpY2FifGRvcmlzfGFtYXlhfHczbXxuZXRzdXJmfHNsZWlwbmlyKVtcXC9cXHNdPyhbXFx3XFwuXSspL2ksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvbGFyaXMvTHlueC9EaWxsby9pQ2FiL0RvcmlzL0FtYXlhL3czbS9OZXRTdXJmL1NsZWlwbmlyXG4gICAgICAgICAgICAvKGxpbmtzKVxcc1xcKChbXFx3XFwuXSspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBMaW5rc1xuICAgICAgICAgICAgLyhnb2Jyb3dzZXIpXFwvPyhbXFx3XFwuXSopL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBHb0Jyb3dzZXJcbiAgICAgICAgICAgIC8oaWNlXFxzP2Jyb3dzZXIpXFwvdj8oW1xcd1xcLl9dKykvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElDRSBCcm93c2VyXG4gICAgICAgICAgICAvKG1vc2FpYylbXFwvXFxzXShbXFx3XFwuXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNb3NhaWNcbiAgICAgICAgICAgIF0sIFtOQU1FLCBWRVJTSU9OXVxuICAgICAgICBdLFxuXG4gICAgICAgIGNwdSA6IFtbXG5cbiAgICAgICAgICAgIC8oPzooYW1kfHgoPzooPzo4Nnw2NClbXy1dKT98d293fHdpbik2NClbO1xcKV0vaSAgICAgICAgICAgICAgICAgICAgIC8vIEFNRDY0XG4gICAgICAgICAgICBdLCBbW0FSQ0hJVEVDVFVSRSwgJ2FtZDY0J11dLCBbXG5cbiAgICAgICAgICAgIC8oaWEzMig/PTspKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSUEzMiAocXVpY2t0aW1lKVxuICAgICAgICAgICAgXSwgW1tBUkNISVRFQ1RVUkUsIHV0aWwubG93ZXJpemVdXSwgW1xuXG4gICAgICAgICAgICAvKCg/OmlbMzQ2XXx4KTg2KVs7XFwpXS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJQTMyXG4gICAgICAgICAgICBdLCBbW0FSQ0hJVEVDVFVSRSwgJ2lhMzInXV0sIFtcblxuICAgICAgICAgICAgLy8gUG9ja2V0UEMgbWlzdGFrZW5seSBpZGVudGlmaWVkIGFzIFBvd2VyUENcbiAgICAgICAgICAgIC93aW5kb3dzXFxzKGNlfG1vYmlsZSk7XFxzcHBjOy9pXG4gICAgICAgICAgICBdLCBbW0FSQ0hJVEVDVFVSRSwgJ2FybSddXSwgW1xuXG4gICAgICAgICAgICAvKCg/OnBwY3xwb3dlcnBjKSg/OjY0KT8pKD86XFxzbWFjfDt8XFwpKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUG93ZXJQQ1xuICAgICAgICAgICAgXSwgW1tBUkNISVRFQ1RVUkUsIC9vd2VyLywgJycsIHV0aWwubG93ZXJpemVdXSwgW1xuXG4gICAgICAgICAgICAvKHN1bjRcXHcpWztcXCldL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU1BBUkNcbiAgICAgICAgICAgIF0sIFtbQVJDSElURUNUVVJFLCAnc3BhcmMnXV0sIFtcblxuICAgICAgICAgICAgLygoPzphdnIzMnxpYTY0KD89OykpfDY4ayg/PVxcKSl8YXJtKD86NjR8KD89dlxcZCtbO2xdKSl8KD89YXRtZWxcXHMpYXZyfCg/OmlyaXh8bWlwc3xzcGFyYykoPzo2NCk/KD89Oyl8cGEtcmlzYykvaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJQTY0LCA2OEssIEFSTS82NCwgQVZSLzMyLCBJUklYLzY0LCBNSVBTLzY0LCBTUEFSQy82NCwgUEEtUklTQ1xuICAgICAgICAgICAgXSwgW1tBUkNISVRFQ1RVUkUsIHV0aWwubG93ZXJpemVdXVxuICAgICAgICBdLFxuXG4gICAgICAgIGRldmljZSA6IFtbXG5cbiAgICAgICAgICAgIC9cXCgoaXBhZHxwbGF5Ym9vayk7W1xcd1xcc1xcKSw7LV0rKHJpbXxhcHBsZSkvaSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlQYWQvUGxheUJvb2tcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgVkVORE9SLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FwcGxlY29yZW1lZGlhXFwvW1xcd1xcLl0rIFxcKChpcGFkKS8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaVBhZFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnQXBwbGUnXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC8oYXBwbGVcXHN7MCwxfXR2KS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFwcGxlIFRWXG4gICAgICAgICAgICBdLCBbW01PREVMLCAnQXBwbGUgVFYnXSwgW1ZFTkRPUiwgJ0FwcGxlJ11dLCBbXG5cbiAgICAgICAgICAgIC8oYXJjaG9zKVxccyhnYW1lcGFkMj8pL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFyY2hvc1xuICAgICAgICAgICAgLyhocCkuKyh0b3VjaHBhZCkvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBIUCBUb3VjaFBhZFxuICAgICAgICAgICAgLyhocCkuKyh0YWJsZXQpL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBIUCBUYWJsZXRcbiAgICAgICAgICAgIC8oa2luZGxlKVxcLyhbXFx3XFwuXSspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gS2luZGxlXG4gICAgICAgICAgICAvXFxzKG5vb2spW1xcd1xcc10rYnVpbGRcXC8oXFx3KykvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTm9va1xuICAgICAgICAgICAgLyhkZWxsKVxccyhzdHJlYVtrcHJcXHNcXGRdKltcXGRrb10pL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGVsbCBTdHJlYWtcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgLyhrZltBLXpdKylcXHNidWlsZFxcLy4rc2lsa1xcLy9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBLaW5kbGUgRmlyZSBIRFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnQW1hem9uJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuICAgICAgICAgICAgLyhzZHxrZilbMDM0OWhpam9yc3R1d10rXFxzYnVpbGRcXC8uK3NpbGtcXC8vaSAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJlIFBob25lXG4gICAgICAgICAgICBdLCBbW01PREVMLCBtYXBwZXIuc3RyLCBtYXBzLmRldmljZS5hbWF6b24ubW9kZWxdLCBbVkVORE9SLCAnQW1hem9uJ10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuICAgICAgICAgICAgL2FuZHJvaWQuK2FmdChbYm1zXSlcXHNidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmlyZSBUVlxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnQW1hem9uJ10sIFtUWVBFLCBTTUFSVFRWXV0sIFtcblxuICAgICAgICAgICAgL1xcKChpcFtob25lZHxcXHNcXHcqXSspOy4rKGFwcGxlKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpUG9kL2lQaG9uZVxuICAgICAgICAgICAgXSwgW01PREVMLCBWRU5ET1IsIFtUWVBFLCBNT0JJTEVdXSwgW1xuICAgICAgICAgICAgL1xcKChpcFtob25lZHxcXHNcXHcqXSspOy9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpUG9kL2lQaG9uZVxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnQXBwbGUnXSwgW1RZUEUsIE1PQklMRV1dLCBbXG5cbiAgICAgICAgICAgIC8oYmxhY2tiZXJyeSlbXFxzLV0/KFxcdyspL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCbGFja0JlcnJ5XG4gICAgICAgICAgICAvKGJsYWNrYmVycnl8YmVucXxwYWxtKD89XFwtKXxzb255ZXJpY3Nzb258YWNlcnxhc3VzfGRlbGx8bWVpenV8bW90b3JvbGF8cG9seXRyb24pW1xcc18tXT8oW1xcdy1dKikvaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQmVuUS9QYWxtL1NvbnktRXJpY3Nzb24vQWNlci9Bc3VzL0RlbGwvTWVpenUvTW90b3JvbGEvUG9seXRyb25cbiAgICAgICAgICAgIC8oaHApXFxzKFtcXHdcXHNdK1xcdykvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhQIGlQQVFcbiAgICAgICAgICAgIC8oYXN1cyktPyhcXHcrKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFzdXNcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgTU9CSUxFXV0sIFtcbiAgICAgICAgICAgIC9cXChiYjEwO1xccyhcXHcrKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQmxhY2tCZXJyeSAxMFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnQmxhY2tCZXJyeSddLCBbVFlQRSwgTU9CSUxFXV0sIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQXN1cyBUYWJsZXRzXG4gICAgICAgICAgICAvYW5kcm9pZC4rKHRyYW5zZm9bcHJpbWVcXHNdezQsMTB9XFxzXFx3K3xlZWVwY3xzbGlkZXJcXHNcXHcrfG5leHVzIDd8cGFkZm9uZXxwMDBjKS9pXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdBc3VzJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvKHNvbnkpXFxzKHRhYmxldFxcc1twc10pXFxzYnVpbGRcXC8vaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU29ueVxuICAgICAgICAgICAgLyhzb255KT8oPzpzZ3AuKylcXHNidWlsZFxcLy9pXG4gICAgICAgICAgICBdLCBbW1ZFTkRPUiwgJ1NvbnknXSwgW01PREVMLCAnWHBlcmlhIFRhYmxldCddLCBbVFlQRSwgVEFCTEVUXV0sIFtcbiAgICAgICAgICAgIC9hbmRyb2lkLitcXHMoW2MtZ11cXGR7NH18c29bLWxdXFx3KykoPz1cXHNidWlsZFxcL3xcXCkuK2Nocm9tZVxcLyg/IVsxLTZdezAsMX1cXGRcXC4pKS9pXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdTb255J10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvXFxzKG91eWEpXFxzL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3V5YVxuICAgICAgICAgICAgLyhuaW50ZW5kbylcXHMoW3dpZHMzdV0rKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTmludGVuZG9cbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgQ09OU09MRV1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLis7XFxzKHNoaWVsZClcXHNidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOdmlkaWFcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ052aWRpYSddLCBbVFlQRSwgQ09OU09MRV1dLCBbXG5cbiAgICAgICAgICAgIC8ocGxheXN0YXRpb25cXHNbMzRwb3J0YWJsZXZpXSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBsYXlzdGF0aW9uXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdTb255J10sIFtUWVBFLCBDT05TT0xFXV0sIFtcblxuICAgICAgICAgICAgLyhzcHJpbnRcXHMoXFx3KykpL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNwcmludCBQaG9uZXNcbiAgICAgICAgICAgIF0sIFtbVkVORE9SLCBtYXBwZXIuc3RyLCBtYXBzLmRldmljZS5zcHJpbnQudmVuZG9yXSwgW01PREVMLCBtYXBwZXIuc3RyLCBtYXBzLmRldmljZS5zcHJpbnQubW9kZWxdLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgLyhodGMpWztfXFxzLV0rKFtcXHdcXHNdKyg/PVxcKXxcXHNidWlsZCl8XFx3KykvaSwgICAgICAgICAgICAgICAgICAgICAgICAvLyBIVENcbiAgICAgICAgICAgIC8oenRlKS0oXFx3KikvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFpURVxuICAgICAgICAgICAgLyhhbGNhdGVsfGdlZWtzcGhvbmV8bmV4aWFufHBhbmFzb25pY3woPz07XFxzKXNvbnkpW19cXHMtXT8oW1xcdy1dKikvaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGNhdGVsL0dlZWtzUGhvbmUvTmV4aWFuL1BhbmFzb25pYy9Tb255XG4gICAgICAgICAgICBdLCBbVkVORE9SLCBbTU9ERUwsIC9fL2csICcgJ10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvKG5leHVzXFxzOSkvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBIVEMgTmV4dXMgOVxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnSFRDJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvZFxcL2h1YXdlaShbXFx3XFxzLV0rKVs7XFwpXS9pLFxuICAgICAgICAgICAgLyhuZXh1c1xcczZwKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSHVhd2VpXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdIdWF3ZWknXSwgW1RZUEUsIE1PQklMRV1dLCBbXG5cbiAgICAgICAgICAgIC8obWljcm9zb2Z0KTtcXHMobHVtaWFbXFxzXFx3XSspL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWljcm9zb2Z0IEx1bWlhXG4gICAgICAgICAgICBdLCBbVkVORE9SLCBNT0RFTCwgW1RZUEUsIE1PQklMRV1dLCBbXG5cbiAgICAgICAgICAgIC9bXFxzXFwoO10oeGJveCg/Olxcc29uZSk/KVtcXHNcXCk7XS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNaWNyb3NvZnQgWGJveFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnTWljcm9zb2Z0J10sIFtUWVBFLCBDT05TT0xFXV0sIFtcbiAgICAgICAgICAgIC8oa2luXFwuW29uZXR3XXszfSkvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1pY3Jvc29mdCBLaW5cbiAgICAgICAgICAgIF0sIFtbTU9ERUwsIC9cXC4vZywgJyAnXSwgW1ZFTkRPUiwgJ01pY3Jvc29mdCddLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNb3Rvcm9sYVxuICAgICAgICAgICAgL1xccyhtaWxlc3RvbmV8ZHJvaWQoPzpbMi00eF18XFxzKD86YmlvbmljfHgyfHByb3xyYXpyKSk/Oj8oXFxzNGcpPylbXFx3XFxzXStidWlsZFxcLy9pLFxuICAgICAgICAgICAgL21vdFtcXHMtXT8oXFx3KikvaSxcbiAgICAgICAgICAgIC8oWFRcXGR7Myw0fSkgYnVpbGRcXC8vaSxcbiAgICAgICAgICAgIC8obmV4dXNcXHM2KS9pXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdNb3Rvcm9sYSddLCBbVFlQRSwgTU9CSUxFXV0sIFtcbiAgICAgICAgICAgIC9hbmRyb2lkLitcXHMobXo2MFxcZHx4b29tW1xcczJdezAsMn0pXFxzYnVpbGRcXC8vaVxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnTW90b3JvbGEnXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9oYmJ0dlxcL1xcZCtcXC5cXGQrXFwuXFxkK1xccytcXChbXFx3XFxzXSo7XFxzKihcXHdbXjtdKik7KFteO10qKS9pICAgICAgICAgICAgLy8gSGJiVFYgZGV2aWNlc1xuICAgICAgICAgICAgXSwgW1tWRU5ET1IsIHV0aWwudHJpbV0sIFtNT0RFTCwgdXRpbC50cmltXSwgW1RZUEUsIFNNQVJUVFZdXSwgW1xuXG4gICAgICAgICAgICAvaGJidHYuK21hcGxlOyhcXGQrKS9pXG4gICAgICAgICAgICBdLCBbW01PREVMLCAvXi8sICdTbWFydFRWJ10sIFtWRU5ET1IsICdTYW1zdW5nJ10sIFtUWVBFLCBTTUFSVFRWXV0sIFtcblxuICAgICAgICAgICAgL1xcKGR0dltcXCk7XS4rKGFxdW9zKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNoYXJwXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdTaGFycCddLCBbVFlQRSwgU01BUlRUVl1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLisoKHNjaC1pWzg5XTBcXGR8c2h3LW0zODBzfGd0LXBcXGR7NH18Z3QtblxcZCt8c2doLXQ4WzU2XTl8bmV4dXMgMTApKS9pLFxuICAgICAgICAgICAgLygoU00tVFxcdyspKS9pXG4gICAgICAgICAgICBdLCBbW1ZFTkRPUiwgJ1NhbXN1bmcnXSwgTU9ERUwsIFtUWVBFLCBUQUJMRVRdXSwgWyAgICAgICAgICAgICAgICAgIC8vIFNhbXN1bmdcbiAgICAgICAgICAgIC9zbWFydC10di4rKHNhbXN1bmcpL2lcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIFtUWVBFLCBTTUFSVFRWXSwgTU9ERUxdLCBbXG4gICAgICAgICAgICAvKChzW2NncF1oLVxcdyt8Z3QtXFx3K3xnYWxheHlcXHNuZXh1c3xzbS1cXHdbXFx3XFxkXSspKS9pLFxuICAgICAgICAgICAgLyhzYW1bc3VuZ10qKVtcXHMtXSooXFx3Ky0/W1xcdy1dKikvaSxcbiAgICAgICAgICAgIC9zZWMtKChzZ2hcXHcrKSkvaVxuICAgICAgICAgICAgXSwgW1tWRU5ET1IsICdTYW1zdW5nJ10sIE1PREVMLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgL3NpZS0oXFx3KikvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2llbWVuc1xuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnU2llbWVucyddLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgLyhtYWVtb3xub2tpYSkuKihuOTAwfGx1bWlhXFxzXFxkKykvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5va2lhXG4gICAgICAgICAgICAvKG5va2lhKVtcXHNfLV0/KFtcXHctXSopL2lcbiAgICAgICAgICAgIF0sIFtbVkVORE9SLCAnTm9raWEnXSwgTU9ERUwsIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZFt4XFxkXFwuXFxzO10rXFxzKFthYl1bMS03XVxcLT9bMDE3OGFdXFxkXFxkPykvaSAgICAgICAgICAgICAgICAgICAvLyBBY2VyXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdBY2VyJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rKFt2bF1rXFwtP1xcZHszfSlcXHMrYnVpbGQvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExHIFRhYmxldFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnTEcnXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG4gICAgICAgICAgICAvYW5kcm9pZFxcczNcXC5bXFxzXFx3Oy1dezEwfShsZz8pLShbMDZjdjldezMsNH0pL2kgICAgICAgICAgICAgICAgICAgICAvLyBMRyBUYWJsZXRcbiAgICAgICAgICAgIF0sIFtbVkVORE9SLCAnTEcnXSwgTU9ERUwsIFtUWVBFLCBUQUJMRVRdXSwgW1xuICAgICAgICAgICAgLyhsZykgbmV0Y2FzdFxcLnR2L2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTEcgU21hcnRUVlxuICAgICAgICAgICAgXSwgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBTTUFSVFRWXV0sIFtcbiAgICAgICAgICAgIC8obmV4dXNcXHNbNDVdKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExHXG4gICAgICAgICAgICAvbGdbZTtcXHNcXC8tXSsoXFx3KikvaSxcbiAgICAgICAgICAgIC9hbmRyb2lkLitsZyhcXC0/W1xcZFxcd10rKVxccytidWlsZC9pXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdMRyddLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgLyhsZW5vdm8pXFxzPyhzKD86NTAwMHw2MDAwKSg/OltcXHctXSspfHRhYig/OltcXHNcXHddKykpL2kgICAgICAgICAgICAgLy8gTGVub3ZvIHRhYmxldHNcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgVEFCTEVUXV0sIFtcbiAgICAgICAgICAgIC9hbmRyb2lkLisoaWRlYXRhYlthLXowLTlcXC1cXHNdKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBMZW5vdm9cbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ0xlbm92byddLCBbVFlQRSwgVEFCTEVUXV0sIFtcbiAgICAgICAgICAgIC8obGVub3ZvKVtfXFxzLV0/KFtcXHctXSspL2lcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgL2xpbnV4Oy4rKChqb2xsYSkpOy9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBKb2xsYVxuICAgICAgICAgICAgXSwgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvKChwZWJibGUpKWFwcFxcL1tcXGRcXC5dK1xccy9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQZWJibGVcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgV0VBUkFCTEVdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rO1xccyhvcHBvKVxccz8oW1xcd1xcc10rKVxcc2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT1BQT1xuICAgICAgICAgICAgXSwgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvY3JrZXkvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdvb2dsZSBDaHJvbWVjYXN0XG4gICAgICAgICAgICBdLCBbW01PREVMLCAnQ2hyb21lY2FzdCddLCBbVkVORE9SLCAnR29vZ2xlJ11dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLis7XFxzKGdsYXNzKVxcc1xcZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEdsYXNzXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdHb29nbGUnXSwgW1RZUEUsIFdFQVJBQkxFXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuKztcXHMocGl4ZWwgYylbXFxzKV0vaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdvb2dsZSBQaXhlbCBDXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdHb29nbGUnXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLis7XFxzKHBpeGVsKCBbMjNdKT8oIHhsKT8pW1xccyldL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBHb29nbGUgUGl4ZWxcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ0dvb2dsZSddLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuKztcXHMoXFx3KylcXHMrYnVpbGRcXC9obVxcMS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFhpYW9taSBIb25nbWkgJ251bWVyaWMnIG1vZGVsc1xuICAgICAgICAgICAgL2FuZHJvaWQuKyhobVtcXHNcXC1fXSpub3RlP1tcXHNfXSooPzpcXGRcXHcpPylcXHMrYnVpbGQvaSwgICAgICAgICAgICAgICAvLyBYaWFvbWkgSG9uZ21pXG4gICAgICAgICAgICAvYW5kcm9pZC4rKG1pW1xcc1xcLV9dKig/OmFcXGR8b25lfG9uZVtcXHNfXXBsdXN8bm90ZSBsdGUpP1tcXHNfXSooPzpcXGQ/XFx3PylbXFxzX10qKD86cGx1cyk/KVxccytidWlsZC9pLCAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gWGlhb21pIE1pXG4gICAgICAgICAgICAvYW5kcm9pZC4rKHJlZG1pW1xcc1xcLV9dKig/Om5vdGUpPyg/OltcXHNfXSpbXFx3XFxzXSspKVxccytidWlsZC9pICAgICAgIC8vIFJlZG1pIFBob25lc1xuICAgICAgICAgICAgXSwgW1tNT0RFTCwgL18vZywgJyAnXSwgW1ZFTkRPUiwgJ1hpYW9taSddLCBbVFlQRSwgTU9CSUxFXV0sIFtcbiAgICAgICAgICAgIC9hbmRyb2lkLisobWlbXFxzXFwtX10qKD86cGFkKSg/OltcXHNfXSpbXFx3XFxzXSspKVxccytidWlsZC9pICAgICAgICAgICAgLy8gTWkgUGFkIHRhYmxldHNcbiAgICAgICAgICAgIF0sW1tNT0RFTCwgL18vZywgJyAnXSwgW1ZFTkRPUiwgJ1hpYW9taSddLCBbVFlQRSwgVEFCTEVUXV0sIFtcbiAgICAgICAgICAgIC9hbmRyb2lkLis7XFxzKG1bMS01XVxcc25vdGUpXFxzYnVpbGQvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWVpenVcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ01laXp1J10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuICAgICAgICAgICAgLyhteiktKFtcXHctXXsyLH0pL2lcbiAgICAgICAgICAgIF0sIFtbVkVORE9SLCAnTWVpenUnXSwgTU9ERUwsIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rYTAwMCgxKVxccytidWlsZC9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmVQbHVzXG4gICAgICAgICAgICAvYW5kcm9pZC4rb25lcGx1c1xccyhhXFxkezR9KVxccytidWlsZC9pXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdPbmVQbHVzJ10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKihSQ1RbXFxkXFx3XSspXFxzK2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUkNBIFRhYmxldHNcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ1JDQSddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXFxzXSsoVmVudWVbXFxkXFxzXXsyLDd9KVxccytidWlsZC9pICAgICAgICAgICAgICAgICAgICAgIC8vIERlbGwgVmVudWUgVGFibGV0c1xuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnRGVsbCddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccyooUVtUfE1dW1xcZFxcd10rKVxccytidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZlcml6b24gVGFibGV0XG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdWZXJpem9uJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKyhCYXJuZXNbJlxcc10rTm9ibGVcXHMrfEJOW1JUXSkoVj8uKilcXHMrYnVpbGQvaSAgICAgLy8gQmFybmVzICYgTm9ibGUgVGFibGV0XG4gICAgICAgICAgICBdLCBbW1ZFTkRPUiwgJ0Jhcm5lcyAmIE5vYmxlJ10sIE1PREVMLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccysoVE1cXGR7M30uKlxcYilcXHMrYnVpbGQvaSAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJhcm5lcyAmIE5vYmxlIFRhYmxldFxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnTnVWaXNpb24nXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLis7XFxzKGs4OClcXHNidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBaVEUgSyBTZXJpZXMgVGFibGV0XG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdaVEUnXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLitbO1xcL11cXHMqKGdlblxcZHszfSlcXHMrYnVpbGQuKjQ5aC9pICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN3aXNzIEdFTiBNb2JpbGVcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ1N3aXNzJ10sIFtUWVBFLCBNT0JJTEVdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKih6dXJcXGR7M30pXFxzK2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTd2lzcyBaVVIgVGFibGV0XG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdTd2lzcyddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccyooKFpla2kpP1RCLipcXGIpXFxzK2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgLy8gWmVraSBUYWJsZXRzXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdaZWtpJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvKGFuZHJvaWQpLitbO1xcL11cXHMrKFtZUl1cXGR7Mn0pXFxzK2J1aWxkL2ksXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKyhEcmFnb25bXFwtXFxzXStUb3VjaFxccyt8RFQpKFxcd3s1fSlcXHNidWlsZC9pICAgICAgICAvLyBEcmFnb24gVG91Y2ggVGFibGV0XG4gICAgICAgICAgICBdLCBbW1ZFTkRPUiwgJ0RyYWdvbiBUb3VjaCddLCBNT0RFTCwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLitbO1xcL11cXHMqKE5TLT9cXHd7MCw5fSlcXHNidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEluc2lnbmlhIFRhYmxldHNcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ0luc2lnbmlhJ10sIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKigoTlh8TmV4dCktP1xcd3swLDl9KVxccytidWlsZC9pICAgICAgICAgICAgICAgICAgICAvLyBOZXh0Qm9vayBUYWJsZXRzXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdOZXh0Qm9vayddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccyooWHRyZW1lXFxfKT8oVigxWzA0NV18MlswMTVdfDMwfDQwfDYwfDdbMDVdfDkwKSlcXHMrYnVpbGQvaVxuICAgICAgICAgICAgXSwgW1tWRU5ET1IsICdWb2ljZSddLCBNT0RFTCwgW1RZUEUsIE1PQklMRV1dLCBbICAgICAgICAgICAgICAgICAgICAvLyBWb2ljZSBYdHJlbWUgUGhvbmVzXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLitbO1xcL11cXHMqKExWVEVMXFwtKT8oVjFbMTJdKVxccytidWlsZC9pICAgICAgICAgICAgICAgICAgICAgLy8gTHZUZWwgUGhvbmVzXG4gICAgICAgICAgICBdLCBbW1ZFTkRPUiwgJ0x2VGVsJ10sIE1PREVMLCBbVFlQRSwgTU9CSUxFXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuKztcXHMoUEgtMSlcXHMvaVxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnRXNzZW50aWFsJ10sIFtUWVBFLCBNT0JJTEVdXSwgWyAgICAgICAgICAgICAgICAvLyBFc3NlbnRpYWwgUEgtMVxuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKihWKDEwME1EfDcwME5BfDcwMTF8OTE3RykuKlxcYilcXHMrYnVpbGQvaSAgICAgICAgICAvLyBFbnZpemVuIFRhYmxldHNcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ0Vudml6ZW4nXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLitbO1xcL11cXHMqKExlW1xcc1xcLV0rUGFuKVtcXHNcXC1dKyhcXHd7MSw5fSlcXHMrYnVpbGQvaSAgICAgICAgICAvLyBMZSBQYW4gVGFibGV0c1xuICAgICAgICAgICAgXSwgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvYW5kcm9pZC4rWztcXC9dXFxzKihUcmlvW1xcc1xcLV0qLiopXFxzK2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWFjaFNwZWVkIFRhYmxldHNcbiAgICAgICAgICAgIF0sIFtNT0RFTCwgW1ZFTkRPUiwgJ01hY2hTcGVlZCddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccyooVHJpbml0eSlbXFwtXFxzXSooVFxcZHszfSlcXHMrYnVpbGQvaSAgICAgICAgICAgICAgICAvLyBUcmluaXR5IFRhYmxldHNcbiAgICAgICAgICAgIF0sIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuK1s7XFwvXVxccypUVV8oMTQ5MSlcXHMrYnVpbGQvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSb3RvciBUYWJsZXRzXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdSb3RvciddLCBbVFlQRSwgVEFCTEVUXV0sIFtcblxuICAgICAgICAgICAgL2FuZHJvaWQuKyhLUyguKykpXFxzK2J1aWxkL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW1hem9uIEtpbmRsZSBUYWJsZXRzXG4gICAgICAgICAgICBdLCBbTU9ERUwsIFtWRU5ET1IsICdBbWF6b24nXSwgW1RZUEUsIFRBQkxFVF1dLCBbXG5cbiAgICAgICAgICAgIC9hbmRyb2lkLisoR2lnYXNldClbXFxzXFwtXSsoUVxcd3sxLDl9KVxccytidWlsZC9pICAgICAgICAgICAgICAgICAgICAgIC8vIEdpZ2FzZXQgVGFibGV0c1xuICAgICAgICAgICAgXSwgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBUQUJMRVRdXSwgW1xuXG4gICAgICAgICAgICAvXFxzKHRhYmxldHx0YWIpWztcXC9dL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVW5pZGVudGlmaWFibGUgVGFibGV0XG4gICAgICAgICAgICAvXFxzKG1vYmlsZSkoPzpbO1xcL118XFxzc2FmYXJpKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVuaWRlbnRpZmlhYmxlIE1vYmlsZVxuICAgICAgICAgICAgXSwgW1tUWVBFLCB1dGlsLmxvd2VyaXplXSwgVkVORE9SLCBNT0RFTF0sIFtcblxuICAgICAgICAgICAgL1tcXHNcXC9cXChdKHNtYXJ0LT90dilbO1xcKV0vaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU21hcnRUVlxuICAgICAgICAgICAgXSwgW1tUWVBFLCBTTUFSVFRWXV0sIFtcblxuICAgICAgICAgICAgLyhhbmRyb2lkW1xcd1xcLlxcc1xcLV17MCw5fSk7LitidWlsZC9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2VuZXJpYyBBbmRyb2lkIERldmljZVxuICAgICAgICAgICAgXSwgW01PREVMLCBbVkVORE9SLCAnR2VuZXJpYyddXVxuICAgICAgICBdLFxuXG4gICAgICAgIGVuZ2luZSA6IFtbXG5cbiAgICAgICAgICAgIC93aW5kb3dzLitcXHNlZGdlXFwvKFtcXHdcXC5dKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVkZ2VIVE1MXG4gICAgICAgICAgICBdLCBbVkVSU0lPTiwgW05BTUUsICdFZGdlSFRNTCddXSwgW1xuXG4gICAgICAgICAgICAvd2Via2l0XFwvNTM3XFwuMzYuK2Nocm9tZVxcLyg/ITI3KS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJsaW5rXG4gICAgICAgICAgICBdLCBbW05BTUUsICdCbGluayddXSwgW1xuXG4gICAgICAgICAgICAvKHByZXN0bylcXC8oW1xcd1xcLl0rKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFByZXN0b1xuICAgICAgICAgICAgLyh3ZWJraXR8dHJpZGVudHxuZXRmcm9udHxuZXRzdXJmfGFtYXlhfGx5bnh8dzNtfGdvYW5uYSlcXC8oW1xcd1xcLl0rKS9pLCAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlYktpdC9UcmlkZW50L05ldEZyb250L05ldFN1cmYvQW1heWEvTHlueC93M20vR29hbm5hXG4gICAgICAgICAgICAvKGtodG1sfHRhc21hbnxsaW5rcylbXFwvXFxzXVxcKD8oW1xcd1xcLl0rKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gS0hUTUwvVGFzbWFuL0xpbmtzXG4gICAgICAgICAgICAvKGljYWIpW1xcL1xcc10oWzIzXVxcLltcXGRcXC5dKykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaUNhYlxuICAgICAgICAgICAgXSwgW05BTUUsIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC9ydlxcOihbXFx3XFwuXXsxLDl9KS4rKGdlY2tvKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2Vja29cbiAgICAgICAgICAgIF0sIFtWRVJTSU9OLCBOQU1FXVxuICAgICAgICBdLFxuXG4gICAgICAgIG9zIDogW1tcblxuICAgICAgICAgICAgLy8gV2luZG93cyBiYXNlZFxuICAgICAgICAgICAgL21pY3Jvc29mdFxccyh3aW5kb3dzKVxccyh2aXN0YXx4cCkvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdpbmRvd3MgKGlUdW5lcylcbiAgICAgICAgICAgIF0sIFtOQU1FLCBWRVJTSU9OXSwgW1xuICAgICAgICAgICAgLyh3aW5kb3dzKVxcc250XFxzNlxcLjI7XFxzKGFybSkvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2luZG93cyBSVFxuICAgICAgICAgICAgLyh3aW5kb3dzXFxzcGhvbmUoPzpcXHNvcykqKVtcXHNcXC9dPyhbXFxkXFwuXFxzXFx3XSopL2ksICAgICAgICAgICAgICAgICAgIC8vIFdpbmRvd3MgUGhvbmVcbiAgICAgICAgICAgIC8od2luZG93c1xcc21vYmlsZXx3aW5kb3dzKVtcXHNcXC9dPyhbbnRjZVxcZFxcLlxcc10rXFx3KS9pXG4gICAgICAgICAgICBdLCBbTkFNRSwgW1ZFUlNJT04sIG1hcHBlci5zdHIsIG1hcHMub3Mud2luZG93cy52ZXJzaW9uXV0sIFtcbiAgICAgICAgICAgIC8od2luKD89M3w5fG4pfHdpblxcczl4XFxzKShbbnRcXGRcXC5dKykvaVxuICAgICAgICAgICAgXSwgW1tOQU1FLCAnV2luZG93cyddLCBbVkVSU0lPTiwgbWFwcGVyLnN0ciwgbWFwcy5vcy53aW5kb3dzLnZlcnNpb25dXSwgW1xuXG4gICAgICAgICAgICAvLyBNb2JpbGUvRW1iZWRkZWQgT1NcbiAgICAgICAgICAgIC9cXCgoYmIpKDEwKTsvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJsYWNrQmVycnkgMTBcbiAgICAgICAgICAgIF0sIFtbTkFNRSwgJ0JsYWNrQmVycnknXSwgVkVSU0lPTl0sIFtcbiAgICAgICAgICAgIC8oYmxhY2tiZXJyeSlcXHcqXFwvPyhbXFx3XFwuXSopL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJsYWNrYmVycnlcbiAgICAgICAgICAgIC8odGl6ZW4pW1xcL1xcc10oW1xcd1xcLl0rKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRpemVuXG4gICAgICAgICAgICAvKGFuZHJvaWR8d2Vib3N8cGFsbVxcc29zfHFueHxiYWRhfHJpbVxcc3RhYmxldFxcc29zfG1lZWdvfHNhaWxmaXNofGNvbnRpa2kpW1xcL1xccy1dPyhbXFx3XFwuXSopL2lcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW5kcm9pZC9XZWJPUy9QYWxtL1FOWC9CYWRhL1JJTS9NZWVHby9Db250aWtpL1NhaWxmaXNoIE9TXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcbiAgICAgICAgICAgIC8oc3ltYmlhblxccz9vc3xzeW1ib3N8czYwKD89OykpW1xcL1xccy1dPyhbXFx3XFwuXSopL2kgICAgICAgICAgICAgICAgICAvLyBTeW1iaWFuXG4gICAgICAgICAgICBdLCBbW05BTUUsICdTeW1iaWFuJ10sIFZFUlNJT05dLCBbXG4gICAgICAgICAgICAvXFwoKHNlcmllczQwKTsvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTZXJpZXMgNDBcbiAgICAgICAgICAgIF0sIFtOQU1FXSwgW1xuICAgICAgICAgICAgL21vemlsbGEuK1xcKG1vYmlsZTsuK2dlY2tvLitmaXJlZm94L2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmlyZWZveCBPU1xuICAgICAgICAgICAgXSwgW1tOQU1FLCAnRmlyZWZveCBPUyddLCBWRVJTSU9OXSwgW1xuXG4gICAgICAgICAgICAvLyBDb25zb2xlXG4gICAgICAgICAgICAvKG5pbnRlbmRvfHBsYXlzdGF0aW9uKVxccyhbd2lkczM0cG9ydGFibGV2dV0rKS9pLCAgICAgICAgICAgICAgICAgICAvLyBOaW50ZW5kby9QbGF5c3RhdGlvblxuXG4gICAgICAgICAgICAvLyBHTlUvTGludXggYmFzZWRcbiAgICAgICAgICAgIC8obWludClbXFwvXFxzXFwoXT8oXFx3KikvaSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1pbnRcbiAgICAgICAgICAgIC8obWFnZWlhfHZlY3RvcmxpbnV4KVs7XFxzXS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1hZ2VpYS9WZWN0b3JMaW51eFxuICAgICAgICAgICAgLyhqb2xpfFtreGxuXT91YnVudHV8ZGViaWFufHN1c2V8b3BlbnN1c2V8Z2VudG9vfCg/PVxccylhcmNofHNsYWNrd2FyZXxmZWRvcmF8bWFuZHJpdmF8Y2VudG9zfHBjbGludXhvc3xyZWRoYXR8emVud2Fsa3xsaW5wdXMpW1xcL1xccy1dPyg/IWNocm9tKShbXFx3XFwuLV0qKS9pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBKb2xpL1VidW50dS9EZWJpYW4vU1VTRS9HZW50b28vQXJjaC9TbGFja3dhcmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmVkb3JhL01hbmRyaXZhL0NlbnRPUy9QQ0xpbnV4T1MvUmVkSGF0L1plbndhbGsvTGlucHVzXG4gICAgICAgICAgICAvKGh1cmR8bGludXgpXFxzPyhbXFx3XFwuXSopL2ksICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEh1cmQvTGludXhcbiAgICAgICAgICAgIC8oZ251KVxccz8oW1xcd1xcLl0qKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gR05VXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sIFtcblxuICAgICAgICAgICAgLyhjcm9zKVxcc1tcXHddK1xccyhbXFx3XFwuXStcXHcpL2kgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaHJvbWl1bSBPU1xuICAgICAgICAgICAgXSwgW1tOQU1FLCAnQ2hyb21pdW0gT1MnXSwgVkVSU0lPTl0sW1xuXG4gICAgICAgICAgICAvLyBTb2xhcmlzXG4gICAgICAgICAgICAvKHN1bm9zKVxccz8oW1xcd1xcLlxcZF0qKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTb2xhcmlzXG4gICAgICAgICAgICBdLCBbW05BTUUsICdTb2xhcmlzJ10sIFZFUlNJT05dLCBbXG5cbiAgICAgICAgICAgIC8vIEJTRCBiYXNlZFxuICAgICAgICAgICAgL1xccyhbZnJlbnRvcGMtXXswLDR9YnNkfGRyYWdvbmZseSlcXHM/KFtcXHdcXC5dKikvaSAgICAgICAgICAgICAgICAgICAgLy8gRnJlZUJTRC9OZXRCU0QvT3BlbkJTRC9QQy1CU0QvRHJhZ29uRmx5XG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl0sW1xuXG4gICAgICAgICAgICAvKGhhaWt1KVxccyhcXHcrKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGFpa3VcbiAgICAgICAgICAgIF0sIFtOQU1FLCBWRVJTSU9OXSxbXG5cbiAgICAgICAgICAgIC9jZm5ldHdvcmtcXC8uK2Rhcndpbi9pLFxuICAgICAgICAgICAgL2lwW2hvbmVhZF17Miw0fSg/Oi4qb3NcXHMoW1xcd10rKVxcc2xpa2VcXHNtYWN8O1xcc29wZXJhKS9pICAgICAgICAgICAgIC8vIGlPU1xuICAgICAgICAgICAgXSwgW1tWRVJTSU9OLCAvXy9nLCAnLiddLCBbTkFNRSwgJ2lPUyddXSwgW1xuXG4gICAgICAgICAgICAvKG1hY1xcc29zXFxzeClcXHM/KFtcXHdcXHNcXC5dKikvaSxcbiAgICAgICAgICAgIC8obWFjaW50b3NofG1hYyg/PV9wb3dlcnBjKVxccykvaSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1hYyBPU1xuICAgICAgICAgICAgXSwgW1tOQU1FLCAnTWFjIE9TJ10sIFtWRVJTSU9OLCAvXy9nLCAnLiddXSwgW1xuXG4gICAgICAgICAgICAvLyBPdGhlclxuICAgICAgICAgICAgLygoPzpvcGVuKT9zb2xhcmlzKVtcXC9cXHMtXT8oW1xcd1xcLl0qKS9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU29sYXJpc1xuICAgICAgICAgICAgLyhhaXgpXFxzKChcXGQpKD89XFwufFxcKXxcXHMpW1xcd1xcLl0pKi9pLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQUlYXG4gICAgICAgICAgICAvKHBsYW5cXHM5fG1pbml4fGJlb3N8b3NcXC8yfGFtaWdhb3N8bW9ycGhvc3xyaXNjXFxzb3N8b3BlbnZtc3xmdWNoc2lhKS9pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQbGFuOS9NaW5peC9CZU9TL09TMi9BbWlnYU9TL01vcnBoT1MvUklTQ09TL09wZW5WTVMvRnVjaHNpYVxuICAgICAgICAgICAgLyh1bml4KVxccz8oW1xcd1xcLl0qKS9pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVTklYXG4gICAgICAgICAgICBdLCBbTkFNRSwgVkVSU0lPTl1cbiAgICAgICAgXVxuICAgIH07XG5cblxuICAgIC8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gQ29uc3RydWN0b3JcbiAgICAvLy8vLy8vLy8vLy8vLy8vXG4gICAgdmFyIFVBUGFyc2VyID0gZnVuY3Rpb24gKHVhc3RyaW5nLCBleHRlbnNpb25zKSB7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB1YXN0cmluZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGV4dGVuc2lvbnMgPSB1YXN0cmluZztcbiAgICAgICAgICAgIHVhc3RyaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFVBUGFyc2VyKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBVQVBhcnNlcih1YXN0cmluZywgZXh0ZW5zaW9ucykuZ2V0UmVzdWx0KCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdWEgPSB1YXN0cmluZyB8fCAoKHdpbmRvdyAmJiB3aW5kb3cubmF2aWdhdG9yICYmIHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA/IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50IDogRU1QVFkpO1xuICAgICAgICB2YXIgcmd4bWFwID0gZXh0ZW5zaW9ucyA/IHV0aWwuZXh0ZW5kKHJlZ2V4ZXMsIGV4dGVuc2lvbnMpIDogcmVnZXhlcztcblxuICAgICAgICB0aGlzLmdldEJyb3dzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYnJvd3NlciA9IHsgbmFtZTogdW5kZWZpbmVkLCB2ZXJzaW9uOiB1bmRlZmluZWQgfTtcbiAgICAgICAgICAgIG1hcHBlci5yZ3guY2FsbChicm93c2VyLCB1YSwgcmd4bWFwLmJyb3dzZXIpO1xuICAgICAgICAgICAgYnJvd3Nlci5tYWpvciA9IHV0aWwubWFqb3IoYnJvd3Nlci52ZXJzaW9uKTsgLy8gZGVwcmVjYXRlZFxuICAgICAgICAgICAgcmV0dXJuIGJyb3dzZXI7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0Q1BVID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNwdSA9IHsgYXJjaGl0ZWN0dXJlOiB1bmRlZmluZWQgfTtcbiAgICAgICAgICAgIG1hcHBlci5yZ3guY2FsbChjcHUsIHVhLCByZ3htYXAuY3B1KTtcbiAgICAgICAgICAgIHJldHVybiBjcHU7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0RGV2aWNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGRldmljZSA9IHsgdmVuZG9yOiB1bmRlZmluZWQsIG1vZGVsOiB1bmRlZmluZWQsIHR5cGU6IHVuZGVmaW5lZCB9O1xuICAgICAgICAgICAgbWFwcGVyLnJneC5jYWxsKGRldmljZSwgdWEsIHJneG1hcC5kZXZpY2UpO1xuICAgICAgICAgICAgcmV0dXJuIGRldmljZTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRFbmdpbmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZW5naW5lID0geyBuYW1lOiB1bmRlZmluZWQsIHZlcnNpb246IHVuZGVmaW5lZCB9O1xuICAgICAgICAgICAgbWFwcGVyLnJneC5jYWxsKGVuZ2luZSwgdWEsIHJneG1hcC5lbmdpbmUpO1xuICAgICAgICAgICAgcmV0dXJuIGVuZ2luZTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRPUyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBvcyA9IHsgbmFtZTogdW5kZWZpbmVkLCB2ZXJzaW9uOiB1bmRlZmluZWQgfTtcbiAgICAgICAgICAgIG1hcHBlci5yZ3guY2FsbChvcywgdWEsIHJneG1hcC5vcyk7XG4gICAgICAgICAgICByZXR1cm4gb3M7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0UmVzdWx0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1YSAgICAgIDogdGhpcy5nZXRVQSgpLFxuICAgICAgICAgICAgICAgIGJyb3dzZXIgOiB0aGlzLmdldEJyb3dzZXIoKSxcbiAgICAgICAgICAgICAgICBlbmdpbmUgIDogdGhpcy5nZXRFbmdpbmUoKSxcbiAgICAgICAgICAgICAgICBvcyAgICAgIDogdGhpcy5nZXRPUygpLFxuICAgICAgICAgICAgICAgIGRldmljZSAgOiB0aGlzLmdldERldmljZSgpLFxuICAgICAgICAgICAgICAgIGNwdSAgICAgOiB0aGlzLmdldENQVSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdldFVBID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHVhO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldFVBID0gZnVuY3Rpb24gKHVhc3RyaW5nKSB7XG4gICAgICAgICAgICB1YSA9IHVhc3RyaW5nO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBVQVBhcnNlci5WRVJTSU9OID0gTElCVkVSU0lPTjtcbiAgICBVQVBhcnNlci5CUk9XU0VSID0ge1xuICAgICAgICBOQU1FICAgIDogTkFNRSxcbiAgICAgICAgTUFKT1IgICA6IE1BSk9SLCAvLyBkZXByZWNhdGVkXG4gICAgICAgIFZFUlNJT04gOiBWRVJTSU9OXG4gICAgfTtcbiAgICBVQVBhcnNlci5DUFUgPSB7XG4gICAgICAgIEFSQ0hJVEVDVFVSRSA6IEFSQ0hJVEVDVFVSRVxuICAgIH07XG4gICAgVUFQYXJzZXIuREVWSUNFID0ge1xuICAgICAgICBNT0RFTCAgIDogTU9ERUwsXG4gICAgICAgIFZFTkRPUiAgOiBWRU5ET1IsXG4gICAgICAgIFRZUEUgICAgOiBUWVBFLFxuICAgICAgICBDT05TT0xFIDogQ09OU09MRSxcbiAgICAgICAgTU9CSUxFICA6IE1PQklMRSxcbiAgICAgICAgU01BUlRUViA6IFNNQVJUVFYsXG4gICAgICAgIFRBQkxFVCAgOiBUQUJMRVQsXG4gICAgICAgIFdFQVJBQkxFOiBXRUFSQUJMRSxcbiAgICAgICAgRU1CRURERUQ6IEVNQkVEREVEXG4gICAgfTtcbiAgICBVQVBhcnNlci5FTkdJTkUgPSB7XG4gICAgICAgIE5BTUUgICAgOiBOQU1FLFxuICAgICAgICBWRVJTSU9OIDogVkVSU0lPTlxuICAgIH07XG4gICAgVUFQYXJzZXIuT1MgPSB7XG4gICAgICAgIE5BTUUgICAgOiBOQU1FLFxuICAgICAgICBWRVJTSU9OIDogVkVSU0lPTlxuICAgIH07XG5cbiAgICAvLy8vLy8vLy8vL1xuICAgIC8vIEV4cG9ydFxuICAgIC8vLy8vLy8vLy9cblxuXG4gICAgLy8gY2hlY2sganMgZW52aXJvbm1lbnRcbiAgICBpZiAodHlwZW9mKGV4cG9ydHMpICE9PSBVTkRFRl9UWVBFKSB7XG4gICAgICAgIC8vIG5vZGVqcyBlbnZcbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09IFVOREVGX1RZUEUgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IFVBUGFyc2VyO1xuICAgICAgICB9XG4gICAgICAgIGV4cG9ydHMuVUFQYXJzZXIgPSBVQVBhcnNlcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyByZXF1aXJlanMgZW52IChvcHRpb25hbClcbiAgICAgICAgaWYgKHR5cGVvZihkZWZpbmUpID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgICAgIGRlZmluZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFVBUGFyc2VyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2luZG93KSB7XG4gICAgICAgICAgICAvLyBicm93c2VyIGVudlxuICAgICAgICAgICAgd2luZG93LlVBUGFyc2VyID0gVUFQYXJzZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBqUXVlcnkvWmVwdG8gc3BlY2lmaWMgKG9wdGlvbmFsKVxuICAgIC8vIE5vdGU6XG4gICAgLy8gICBJbiBBTUQgZW52IHRoZSBnbG9iYWwgc2NvcGUgc2hvdWxkIGJlIGtlcHQgY2xlYW4sIGJ1dCBqUXVlcnkgaXMgYW4gZXhjZXB0aW9uLlxuICAgIC8vICAgalF1ZXJ5IGFsd2F5cyBleHBvcnRzIHRvIGdsb2JhbCBzY29wZSwgdW5sZXNzIGpRdWVyeS5ub0NvbmZsaWN0KHRydWUpIGlzIHVzZWQsXG4gICAgLy8gICBhbmQgd2Ugc2hvdWxkIGNhdGNoIHRoYXQuXG4gICAgdmFyICQgPSB3aW5kb3cgJiYgKHdpbmRvdy5qUXVlcnkgfHwgd2luZG93LlplcHRvKTtcbiAgICBpZiAodHlwZW9mICQgIT09IFVOREVGX1RZUEUgJiYgISQudWEpIHtcbiAgICAgICAgdmFyIHBhcnNlciA9IG5ldyBVQVBhcnNlcigpO1xuICAgICAgICAkLnVhID0gcGFyc2VyLmdldFJlc3VsdCgpO1xuICAgICAgICAkLnVhLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZXIuZ2V0VUEoKTtcbiAgICAgICAgfTtcbiAgICAgICAgJC51YS5zZXQgPSBmdW5jdGlvbiAodWFzdHJpbmcpIHtcbiAgICAgICAgICAgIHBhcnNlci5zZXRVQSh1YXN0cmluZyk7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gcGFyc2VyLmdldFJlc3VsdCgpO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAkLnVhW3Byb3BdID0gcmVzdWx0W3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxufSkodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcgPyB3aW5kb3cgOiB0aGlzKTtcbiIsInZhciBsb2dIYW5kbGVyID0gcmVxdWlyZSgnLi9sb2ctaGFuZGxlcicpO1xuXG52YXIgaW5mbyA9IHtcbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgcGFydHMgPSBbb3B0aW9ucy5zdGF0aWNSb290LCBvcHRpb25zLmdhbWVdO1xuICAgICAgICBpZihvcHRpb25zLnZlcnNpb24pIHtcbiAgICAgICAgICAgIHBhcnRzLnB1c2gob3B0aW9ucy52ZXJzaW9uKTtcbiAgICAgICAgfVxuICAgICAgICBwYXJ0cy5wdXNoKCdpbmZvLmpzb24nKTtcblxuICAgICAgICB2YXIgdXJsID0gcGFydHMuam9pbignLycpO1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRmFpbCgpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IHJlcXVlc3Quc3RhdHVzVGV4dCB8fCAnTm8gZXJyb3IgbWVzc2FnZSBhdmFpbGFibGU7IENPUlMgb3Igc2VydmVyIG1pc3Npbmc/JztcbiAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZihyZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5mbztcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpbmZvID0gSlNPTi5wYXJzZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uc3RhdGljUm9vdCA9IFtvcHRpb25zLnN0YXRpY1Jvb3QsIGluZm8ubmFtZSwgaW5mby52ZXJzaW9uXS5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uYXNwZWN0UmF0aW8gPSBpbmZvLnNpemUud2lkdGggLyBpbmZvLnNpemUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBpbmZvLmluZm9Kc29uID0gdXJsO1xuXG4gICAgICAgICAgICAgICAgICAgIGxvZ0hhbmRsZXIuc2V0RXh0cmEoJ3ZlcnNpb24nLCBpbmZvLnZlcnNpb24pO1xuICAgICAgICAgICAgICAgICAgICB2YXIgY291bnRyeSA9IHJlcXVlc3QuZ2V0UmVzcG9uc2VIZWFkZXIoJ3gtY291bnRyeScpO1xuICAgICAgICAgICAgICAgICAgICBpZihjb3VudHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLmNvdW50cnkgPSBjb3VudHJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSGFuZGxlci5zZXRFeHRyYSgnY291bnRyeScsIGNvdW50cnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soaW5mbyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9uRmFpbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IG9uRmFpbDtcblxuICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluZm87XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcjbm9saW1pdC1zd2lwZS1ibG9ja2VyIHtcXG4gICAgaGVpZ2h0OiAxMjB2aDtcXG4gICAgcG9zaXRpb246IGZpeGVkO1xcbiAgICB0b3A6IDA7XFxuICAgIHotaW5kZXg6IDI7XFxufVxcblxcbiNub2xpbWl0LXN3aXBlLW92ZXJsYXkge1xcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBibGFjaztcXG4gICAgb3BhY2l0eTogMC41O1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAxMDAlO1xcbiAgICBwb3NpdGlvbjogZml4ZWQ7XFxuICAgIHRvcDogMDtcXG4gICAgbGVmdDogMDtcXG59XFxuXFxuI25vbGltaXQtc3dpcGUtYXJyb3cge1xcbiAgICBoZWlnaHQ6IDMwJTtcXG4gICAgd2lkdGg6IDMwJTtcXG4gICAgdG9wOiAzNXZoO1xcbiAgICBsZWZ0OiAzMHZ3O1xcbiAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcXG4gICAgei1pbmRleDogMTA7XFxuICAgIHBvc2l0aW9uOiBmaXhlZDtcXG59XFxuXFxuQGtleWZyYW1lcyBub2xpbWl0LWZpbmdlciB7XFxuICAgIGZyb20ge1xcbiAgICAgICAgdG9wOiA1NXZoO1xcbiAgICB9XFxuICAgIHRvIHtcXG4gICAgICAgIHRvcDogMzV2aDtcXG4gICAgfVxcbn1cXG5cXG4jbm9saW1pdC1zd2lwZS1maW5nZXIge1xcbiAgICBoZWlnaHQ6IDMwJTtcXG4gICAgd2lkdGg6IDMwJTtcXG4gICAgdG9wOiA1NXZoO1xcbiAgICBsZWZ0OiAzNnZ3O1xcbiAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcXG4gICAgei1pbmRleDogMTA7XFxuICAgIHBvc2l0aW9uOiBmaXhlZDtcXG5cXG4gICAgYW5pbWF0aW9uLWR1cmF0aW9uOiAxcztcXG4gICAgYW5pbWF0aW9uLW5hbWU6IG5vbGltaXQtZmluZ2VyO1xcbiAgICBhbmltYXRpb24taXRlcmF0aW9uLWNvdW50OiBpbmZpbml0ZTtcXG4gICAgYW5pbWF0aW9uLWRpcmVjdGlvbjogYWx0ZXJuYXRlO1xcbn1cXG4nOyIsInZhciBCQVNFX1VSTCA9ICdodHRwczovL25vbGltaXRqcy5ub2xpbWl0Y2RuLmNvbS9pbWcnO1xudmFyIEZJTkdFUiA9IEJBU0VfVVJMICsgJy9maW5nZXIuc3ZnJztcbnZhciBBUlJPVyA9IEJBU0VfVVJMICsgJy9hcnJvdy5zdmcnO1xuXG52YXIgZnVsbHNjcmVlbiA9IGZhbHNlO1xuXG5mdW5jdGlvbiBwcmV2ZW50UmVzaXplKGUpIHtcbiAgICBpZihlLnNjYWxlICE9PSAxKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldE9yaWVudGF0aW9uKCkge1xuICAgIHJldHVybiB3aW5kb3cuaW5uZXJIZWlnaHQgPiB3aW5kb3cuaW5uZXJXaWR0aCA/ICdwb3J0cmFpdCcgOiAnbGFuZHNjYXBlJztcbn1cblxuZnVuY3Rpb24gYWRkQ3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShyZXF1aXJlKCcuL2lvcy1mdWxsc2NyZWVuLmNzcycpKSk7XG59XG5cbnZhciBpb3NGdWxsc2NyZWVuID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMsIGRvY3VtZW50KSB7XG4gICAgICAgIHZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdmFyIGlQaG9uZSA9IHVhLmluZGV4T2YoJ2lwaG9uZScpICE9PSAtMTtcbiAgICAgICAgdmFyIGlzQ2hyb21lID0gdWEuaW5kZXhPZignY3Jpb3MnKSAhPT0gLTE7XG4gICAgICAgIHZhciBpc0ZpcmVmb3ggPSB1YS5pbmRleE9mKCdmeGlvcycpICE9PSAtMTtcbiAgICAgICAgdmFyIGlzWWFuZGV4ID0gdWEuaW5kZXhPZigneWFicm93c2VyJykgIT09IC0xO1xuICAgICAgICB2YXIgc3RhbmRhbG9uZSA9IG5hdmlnYXRvci5zdGFuZGFsb25lID09PSB0cnVlO1xuICAgICAgICB2YXIgaUZyYW1lZCA9IHdpbmRvdy50b3AgIT09IHdpbmRvdy5zZWxmO1xuXG5cbiAgICAgICAgaWYoIWlQaG9uZSB8fCBpc0Nocm9tZSB8fCBpc0ZpcmVmb3ggfHwgaXNZYW5kZXggfHwgc3RhbmRhbG9uZSB8fCBpRnJhbWVkIHx8IG9wdGlvbnMuZGV2aWNlICE9PSAnbW9iaWxlJykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYWRkQ3NzKGRvY3VtZW50KTtcblxuICAgICAgICAvLyBUaGUgZWxlbWVudCB0aGF0IHByZXZlbnRzIHN3aXBlcyBsYXRlclxuICAgICAgICB2YXIgc3dpcGVCbG9ja2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHN3aXBlQmxvY2tlci5pZCA9ICdub2xpbWl0LXN3aXBlLWJsb2NrZXInO1xuXG4gICAgICAgIC8vIFRoZSBFbGVtZW50IGNvbnRhaW5pbmcgdGhlIHN3aXBlIHVwIGFuaW1hdGlvblxuICAgICAgICB2YXIgc3dpcGVPdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHN3aXBlT3ZlcmxheS5pZCA9ICdub2xpbWl0LXN3aXBlLW92ZXJsYXknO1xuXG4gICAgICAgIHZhciBmaW5nZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgZmluZ2VyLmlkID0gJ25vbGltaXQtc3dpcGUtZmluZ2VyJztcbiAgICAgICAgZmluZ2VyLnNyYyA9IEZJTkdFUjtcbiAgICAgICAgc3dpcGVPdmVybGF5LmFwcGVuZENoaWxkKGZpbmdlcik7XG5cbiAgICAgICAgdmFyIGFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgICAgIGFycm93LmlkID0gJ25vbGltaXQtc3dpcGUtYXJyb3cnO1xuICAgICAgICBhcnJvdy5zcmMgPSBBUlJPVztcbiAgICAgICAgc3dpcGVPdmVybGF5LmFwcGVuZENoaWxkKGFycm93KTtcblxuICAgICAgICBzd2lwZUJsb2NrZXIuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgcHJldmVudFJlc2l6ZSk7XG4gICAgICAgIGFycm93LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHByZXZlbnRSZXNpemUpO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc3dpcGVCbG9ja2VyKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzd2lwZU92ZXJsYXkpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGVuYWJsZU92ZXJsYXkoKSB7XG4gICAgICAgICAgICB3aW5kb3cuZm9jdXMoKTtcbiAgICAgICAgICAgIHdpbmRvdy5zY3JvbGxUbygwLCAwKTtcbiAgICAgICAgICAgIHN3aXBlQmxvY2tlci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICAgICAgc3dpcGVCbG9ja2VyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYXV0byc7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBkaXNhYmxlT3ZlcmxheSgpIHtcbiAgICAgICAgICAgIHN3aXBlT3ZlcmxheS5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICAgICAgICBzd2lwZUJsb2NrZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgc3dpcGVCbG9ja2VyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvblJlc2l6ZSgpIHtcbiAgICAgICAgICAgIGlmKGdldE9yaWVudGF0aW9uKCkgPT09ICdsYW5kc2NhcGUnKSB7XG4gICAgICAgICAgICAgICAgZW5hYmxlT3ZlcmxheSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkaXNhYmxlT3ZlcmxheSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2hlY2tFbmRTdGF0ZSgpIHtcbiAgICAgICAgICAgIGlmKHdpbmRvdy5pbm5lckhlaWdodCA+PSBzY3JlZW4ud2lkdGgpIHtcbiAgICAgICAgICAgICAgICBmdWxsc2NyZWVuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaXNhYmxlT3ZlcmxheSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2lwZU92ZXJsYXkuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcblxuICAgICAgICAgICAgICAgIGlmKGZ1bGxzY3JlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlT3ZlcmxheSgpO1xuICAgICAgICAgICAgICAgICAgICBmdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2hlY2tTY3JlZW5TdGF0ZSgpIHtcbiAgICAgICAgICAgIGlmKGdldE9yaWVudGF0aW9uKCkgPT09ICdsYW5kc2NhcGUnKSB7XG4gICAgICAgICAgICAgICAgY2hlY2tFbmRTdGF0ZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2lwZU92ZXJsYXkuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIG9uUmVzaXplKTtcbiAgICAgICAgd2luZG93LnNldEludGVydmFsKGNoZWNrU2NyZWVuU3RhdGUsIDEwKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBvblJlc2l6ZSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpb3NGdWxsc2NyZWVuO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnZGl2Lmp1cmlzZGljdGlvbi1zZS1saW5rcyB7XFxuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gICAgdG9wOiAwO1xcbiAgICBsZWZ0OiAwO1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAyNHB4O1xcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XFxuICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xcbn1cXG5cXG5kaXYuanVyaXNkaWN0aW9uLXNlLWxpbmtzIGltZyB7XFxuICAgIHZlcnRpY2FsLWFsaWduOiBtaWRkbGU7XFxuICAgIGN1cnNvcjogcG9pbnRlcjtcXG4gICAgaGVpZ2h0OiAyMHB4O1xcbiAgICBtYXJnaW46IDJweDtcXG59XFxuXFxuZGl2Lm5vbGltaXQgPiBkaXYua2V5cGFkID4gZGl2LnRvcGJhciA+IGRpdi5jbG9jayB7XFxuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gICAgei1pbmRleDogMjE0NzQ4MzY0NztcXG59XFxuJzsiLCJ2YXIgQkFTRV9VUkwgPSAnaHR0cHM6Ly9ub2xpbWl0anMubm9saW1pdGNkbi5jb20vaW1nJztcbnZhciBTUEVMUEFVUyA9IEJBU0VfVVJMICsgJy9zcGVscGF1cy5zdmcnO1xudmFyIFNQRUxHUkFOU0VSID0gQkFTRV9VUkwgKyAnL3NwZWxncmFuc2VyLnN2Zyc7XG52YXIgU0pBTFZURVNUID0gQkFTRV9VUkwgKyAnL3NqYWx2dGVzdC5zdmcnO1xuXG52YXIgc3BlbHBhdXNVcmw7XG52YXIgc3BlbGdyYW5zZXJVcmw7XG52YXIgc2phbHZ0ZXN0VXJsO1xudmFyIHRhcmdldDtcbnZhciBldmVudHM7XG5cbmZ1bmN0aW9uIGlzTGlua3MoKSB7XG4gICAgcmV0dXJuICEhKHNwZWxwYXVzVXJsICYmIHNwZWxncmFuc2VyVXJsICYmIHNqYWx2dGVzdFVybCk7XG59XG5cbmZ1bmN0aW9uIGlzRXZlbnRzKCkge1xuICAgIHJldHVybiBldmVudHMgPT09IHRydWU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxpc3RlbmVyKGVsZW1lbnQsIHVybCwgdGFyZ2V0LCBldmVudCwgbm9saW1pdEFwaSkge1xuICAgIHZhciBsaW5rcyA9IGlzTGlua3MoKTtcbiAgICB2YXIgZXZlbnRzID0gaXNFdmVudHMoKTtcbiAgICB2YXIgdXJsQ29weSA9ICcnICsgdXJsO1xuICAgIHZhciB0YXJnZXRDb3B5ID0gJycgKyB0YXJnZXQ7XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAobGlua3MpIHtcbiAgICAgICAgICAgIHdpbmRvdy5vcGVuKHVybENvcHksIHRhcmdldENvcHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudHMpIHtcbiAgICAgICAgICAgIG5vbGltaXRBcGkudHJpZ2dlcihldmVudCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxudmFyIGp1cmlzZGljdGlvblNFID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMsIGRvY3VtZW50LCBub2xpbWl0QXBpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdzd2VkZW4gbGlua3MnLCBvcHRpb25zLmp1cmlzZGljdGlvbiwgaXNMaW5rcygpLCBpc0V2ZW50cygpKTtcbiAgICAgICAgaWYgKG9wdGlvbnMuanVyaXNkaWN0aW9uICYmIG9wdGlvbnMuanVyaXNkaWN0aW9uLm5hbWUgPT09ICdTRScgJiYgKGlzTGlua3MoKSB8fCBpc0V2ZW50cygpKSkge1xuICAgICAgICAgICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgICAgICAgICAgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUocmVxdWlyZSgnLi9qdXJpc2RpY3Rpb24tc2UuY3NzJykpKTtcbiAgICAgICAgICAgIHZhciBsaW5rSG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBsaW5rSG9sZGVyLmNsYXNzTGlzdC5hZGQoJ2p1cmlzZGljdGlvbi1zZS1saW5rcycpO1xuXG4gICAgICAgICAgICB2YXIgc3BlbHBhdXNJbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICAgIHNwZWxwYXVzSW1nLnNyYyA9IFNQRUxQQVVTO1xuICAgICAgICAgICAgbGlua0hvbGRlci5hcHBlbmRDaGlsZChzcGVscGF1c0ltZyk7XG4gICAgICAgICAgICBjcmVhdGVMaXN0ZW5lcihzcGVscGF1c0ltZywgc3BlbHBhdXNVcmwsIHRhcmdldCwgJ3NwZWxwYXVzJywgbm9saW1pdEFwaSk7XG5cbiAgICAgICAgICAgIHZhciBzcGVsZ3JhbnNlckltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgICAgc3BlbGdyYW5zZXJJbWcuc3JjID0gU1BFTEdSQU5TRVI7XG4gICAgICAgICAgICBsaW5rSG9sZGVyLmFwcGVuZENoaWxkKHNwZWxncmFuc2VySW1nKTtcbiAgICAgICAgICAgIGNyZWF0ZUxpc3RlbmVyKHNwZWxncmFuc2VySW1nLCBzcGVsZ3JhbnNlclVybCwgdGFyZ2V0LCAnc3BlbGdyYW5zZXInLCBub2xpbWl0QXBpKTtcblxuICAgICAgICAgICAgdmFyIHNqYWx2dGVzdEltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgICAgc2phbHZ0ZXN0SW1nLnNyYyA9IFNKQUxWVEVTVDtcbiAgICAgICAgICAgIGxpbmtIb2xkZXIuYXBwZW5kQ2hpbGQoc2phbHZ0ZXN0SW1nKTtcbiAgICAgICAgICAgIGNyZWF0ZUxpc3RlbmVyKHNqYWx2dGVzdEltZywgc2phbHZ0ZXN0VXJsLCB0YXJnZXQsICdzamFsdnRlc3QnLCBub2xpbWl0QXBpKTtcblxuICAgICAgICAgICAgdmFyIHBsdXMxOCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgIHBsdXMxOC5pbm5lckhUTUwgPSAnKzE4JztcbiAgICAgICAgICAgIHBsdXMxOC5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICAgICAgICAgIGxpbmtIb2xkZXIuYXBwZW5kQ2hpbGQocGx1czE4KTtcblxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaW5rSG9sZGVyKTtcblxuICAgICAgICAgICAgLy92YXIgY29udGFpbmVyID0gZG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yKCcubm9saW1pdC5jb250YWluZXInKTtcbiAgICAgICAgICAgIC8vaWYgKGNvbnRhaW5lcikge1xuICAgICAgICAgICAgLy8gICAgY29udGFpbmVyLnN0eWxlLnRvcCA9ICcyNHB4JztcbiAgICAgICAgICAgIC8vfVxuICAgICAgICB9XG4gICAgfSxcbiAgICB0YWtlT3B0aW9uczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucy5qdXJpc2RpY3Rpb24gJiYgb3B0aW9ucy5qdXJpc2RpY3Rpb24ubmFtZSA9PT0gJ1NFJykge1xuICAgICAgICAgICAgc3BlbHBhdXNVcmwgPSBvcHRpb25zLmp1cmlzZGljdGlvbi5zcGVscGF1cztcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRpb25zLmp1cmlzZGljdGlvbi5zcGVscGF1cztcbiAgICAgICAgICAgIHNwZWxncmFuc2VyVXJsID0gb3B0aW9ucy5qdXJpc2RpY3Rpb24uc3BlbGdyYW5zZXI7XG4gICAgICAgICAgICBkZWxldGUgb3B0aW9ucy5qdXJpc2RpY3Rpb24uc3BlbGdyYW5zZXI7XG4gICAgICAgICAgICBzamFsdnRlc3RVcmwgPSBvcHRpb25zLmp1cmlzZGljdGlvbi5zamFsdnRlc3Q7XG4gICAgICAgICAgICBkZWxldGUgb3B0aW9ucy5qdXJpc2RpY3Rpb24uc2phbHZ0ZXN0O1xuICAgICAgICAgICAgdGFyZ2V0ID0gb3B0aW9ucy5qdXJpc2RpY3Rpb24udGFyZ2V0IHx8ICdfdG9wJztcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRpb25zLmp1cmlzZGljdGlvbi50YXJnZXQ7XG4gICAgICAgICAgICBldmVudHMgPSBvcHRpb25zLmp1cmlzZGljdGlvbi5ldmVudHMgPT09IHRydWU7XG4gICAgICAgICAgICBkZWxldGUgb3B0aW9ucy5qdXJpc2RpY3Rpb24uZXZlbnRzO1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBqdXJpc2RpY3Rpb25TRTtcbiIsInZhciBVQVBhcnNlciA9IHJlcXVpcmUoJ3VhLXBhcnNlci1qcycpO1xudmFyIHVhUGFyc2VyID0gbmV3IFVBUGFyc2VyKCk7XG52YXIgdWEgPSB1YVBhcnNlci5nZXRSZXN1bHQoKTtcblxudmFyIFNFU1NJT05fS0VZID0gJ25vbGltaXQuanMubG9nLnNlc3Npb24nO1xudmFyIFVSTCA9ICdodHRwczovL2dhbWVsb2cubm9saW1pdGNpdHkuY29tLyc7XG52YXIgTEFURVNUID0gJ25vbGltaXQtbGF0ZXN0JztcbnZhciBDVVJSRU5UX1NDUklQVCA9IGN1cnJlbnRTY3JpcHQoKTtcblxudmFyIHNlc3Npb24gPSBoYW5kbGVTZXNzaW9uKCk7XG5cbnZhciBleHRyYXMgPSB7fTtcbnZhciBzdG9yZWRFdmVudHMgPSBbXTtcblxuZnVuY3Rpb24gY3VycmVudFNjcmlwdCgpIHtcbiAgICB0cnkge1xuICAgICAgICB2YXIgc2NyaXB0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKTtcbiAgICAgICAgdmFyIGluZGV4ID0gc2NyaXB0cy5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgdGFnID0gc2NyaXB0c1tpbmRleF07XG5cbiAgICAgICAgcmV0dXJuIHRhZy5zcmM7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1dWlkdjQoKSB7XG4gICAgcmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24oYykge1xuICAgICAgICB2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDAsIHYgPSBjID09PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpO1xuICAgICAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVNlc3Npb24oKSB7XG4gICAgdmFyIGZyb21TdG9yYWdlID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgICBmcm9tU3RvcmFnZSA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oU0VTU0lPTl9LRVkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignQ291bGQgbm90IHJlYWQgc2Vzc2lvbicsIGUpO1xuICAgIH1cbiAgICB2YXIgdG9TYXZlID0gZnJvbVN0b3JhZ2UgfHwgdXVpZHY0KCk7XG4gICAgdHJ5IHtcbiAgICAgICAgc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShTRVNTSU9OX0tFWSwgdG9TYXZlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBzYXZlIHNlc3Npb24nLCBlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRvU2F2ZTtcbn1cblxuZnVuY3Rpb24gc2VuZExvZyhldmVudCwgZGF0YSkge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby13YXJuaW5nLWNvbW1lbnRzXG4gICAgLy8gVE9ETzogdGVtcCBzYWZldHkgbWVhc3VyZVxuICAgIGlmKENVUlJFTlRfU0NSSVBULmluZGV4T2YoTEFURVNUKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKGV4dHJhcy5lbnZpcm9ubWVudCA9PT0gJ3Rlc3QnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkYXRhID0gZGF0YSB8fCB7fTtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignUE9TVCcsIFVSTCwgdHJ1ZSk7XG4gICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXG4gICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYocmVxdWVzdC5zdGF0dXMgPj0gMjAwICYmIHJlcXVlc3Quc3RhdHVzIDwgNDAwKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZSA9IEpTT04ucGFyc2UocmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMb2dnZXIgcmVzcG9uc2U6JywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gc2VuZCBsb2c6JywgZS5tZXNzYWdlLCBldmVudCwgZGF0YSwgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0Vycm9yIGZyb20gc2VydmVyOicsIHJlcXVlc3Quc3RhdHVzLCByZXF1ZXN0LnN0YXR1c1RleHQsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdMb2dnZXIgZXJyb3I6JywgcmVxdWVzdC5zdGF0dXMsIHJlcXVlc3Quc3RhdHVzVGV4dCwgZXZlbnQsIGRhdGEpO1xuICAgIH07XG5cbiAgICB2YXIgZGV2aWNlID0gdWFQYXJzZXIuZ2V0RGV2aWNlKCk7XG4gICAgdmFyIGJvZHkgPSB7XG4gICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgc2Vzc2lvbjogc2Vzc2lvbixcbiAgICAgICAgYnJvd3NlcjogdWEuYnJvd3Nlci5uYW1lICsgJyAnICsgdWEuYnJvd3Nlci52ZXJzaW9uLFxuICAgICAgICBvczogdWEub3MubmFtZSArICcgJyArIHVhLm9zLnZlcnNpb24sXG4gICAgICAgIHZlbmRvcjogZGV2aWNlLnZlbmRvcixcbiAgICAgICAgbW9kZWw6IGRldmljZS5tb2RlbCxcbiAgICAgICAgaGlzdG9yeTogc3RvcmVkRXZlbnRzLnNsaWNlKC0xMCksXG4gICAgICAgIGRlbHRhVGltZTogRGF0ZS5ub3coKSAtIGV4dHJhcy5zdGFydFRpbWVcbiAgICB9O1xuXG4gICAgZm9yKHZhciBuYW1lIGluIGV4dHJhcykge1xuICAgICAgICBib2R5W25hbWVdID0gZXh0cmFzW25hbWVdO1xuICAgIH1cblxuICAgIHZhciBrZXkgPSB1dWlkdjQoKTtcbiAgICBib2R5LmRhdGEgPSBkYXRhO1xuXG4gICAgdmFyIHBheWxvYWQgPSB7a2V5OiBrZXksIGJvZHk6IGJvZHl9O1xuXG4gICAgY29uc29sZS5sb2coJ0xvZ2dpbmcgcGF5bG9hZDonLCBwYXlsb2FkKTtcblxuICAgIHJlcXVlc3Quc2VuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XG59XG5cbnZhciBlcnJvckFscmVhZHlTZW50ID0gZmFsc2U7XG52YXIgbG9nSGFuZGxlciA9IHtcbiAgICBzZW5kRXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYoZXJyb3JBbHJlYWR5U2VudCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0FscmVhZHkgc2VudCBlcnJvcnMsIGJ1dCB3YXMnLCBlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGVycm9yQWxyZWFkeVNlbnQgPSB0cnVlO1xuXG4gICAgICAgIHZhciBtZXNzYWdlID0gZS5tZXNzYWdlIHx8IGU7XG5cbiAgICAgICAgaWYobWVzc2FnZSA9PT0gJ1NjcmlwdCBlcnJvci4nKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihlLmNvZGUpIHtcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlICsgJyAoJyArIGUuY29kZSArICcpJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGUuZmlsZW5hbWUgJiYgZS5saW5lbm8pIHtcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlICsgJyBAICcgKyBlLmZpbGVuYW1lICsgJyBsaW5lOicgKyBlLmxpbmVubztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuc2VuZExvZygnRVJST1InLCBkYXRhKTtcbiAgICB9LFxuXG4gICAgc2VuZExvZzogc2VuZExvZyxcblxuICAgIHNldEV4dHJhOiBmdW5jdGlvbihuYW1lLCBleHRyYSkge1xuICAgICAgICBleHRyYXNbbmFtZV0gPSBleHRyYTtcbiAgICB9LFxuXG4gICAgc2V0RXh0cmFzOiBmdW5jdGlvbihleHRyYXMpIHtcbiAgICAgICAgZm9yKHZhciBuYW1lIGluIGV4dHJhcykge1xuICAgICAgICAgICAgdGhpcy5zZXRFeHRyYShuYW1lLCBleHRyYXNbbmFtZV0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHN0b3JlRXZlbnQ6IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcbiAgICAgICAgdmFyIGV2ZW50ID0ge1xuICAgICAgICAgICAgbmFtZTogZGF0YSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICB9O1xuICAgICAgICBzdG9yZWRFdmVudHMucHVzaChldmVudCk7XG4gICAgfSxcblxuICAgIGdldEV2ZW50czogZnVuY3Rpb24oZmlsdGVyKSB7XG4gICAgICAgIGlmKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIHN0b3JlZEV2ZW50cy5maWx0ZXIoZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnQubmFtZSA9PT0gZmlsdGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0b3JlZEV2ZW50cztcbiAgICB9XG59O1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBvbldpbmRvd0Vycm9yKTtcblxuZnVuY3Rpb24gb25XaW5kb3dFcnJvcihlKSB7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgb25XaW5kb3dFcnJvcik7XG4gICAgY29uc29sZS53YXJuKGUubWVzc2FnZSwgZSk7XG4gICAgbG9nSGFuZGxlci5zZW5kRXJyb3IoZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbG9nSGFuZGxlcjtcbiIsIi8qKlxuICogQGV4cG9ydHMgbm9saW1pdEFwaUZhY3RvcnlcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBub2xpbWl0QXBpRmFjdG9yeSA9IGZ1bmN0aW9uKHRhcmdldCwgb25sb2FkKSB7XG5cbiAgICB2YXIgbGlzdGVuZXJzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZEV2ZW50cyA9IHt9O1xuICAgIHZhciB1bmhhbmRsZWRDYWxscyA9IFtdO1xuICAgIHZhciBwb3J0O1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlVW5oYW5kbGVkQ2FsbHMocG9ydCkge1xuICAgICAgICB3aGlsZSh1bmhhbmRsZWRDYWxscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKHVuaGFuZGxlZENhbGxzLnNoaWZ0KCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkTWVzc2FnZUxpc3RlbmVyKGdhbWVXaW5kb3cpIHtcbiAgICAgICAgZ2FtZVdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYoZS5wb3J0cyAmJiBlLnBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gZS5wb3J0c1swXTtcbiAgICAgICAgICAgICAgICBwb3J0Lm9ubWVzc2FnZSA9IG9uTWVzc2FnZTtcbiAgICAgICAgICAgICAgICBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGdhbWVXaW5kb3cudHJpZ2dlciA9IHRyaWdnZXI7XG4gICAgICAgIGdhbWVXaW5kb3cub24gPSBvbjtcbiAgICAgICAgb25sb2FkKCk7XG4gICAgfVxuXG4gICAgaWYodGFyZ2V0Lm5vZGVOYW1lID09PSAnSUZSQU1FJykge1xuICAgICAgICBpZiAodGFyZ2V0LmNvbnRlbnRXaW5kb3cgJiYgdGFyZ2V0LmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQgJiYgdGFyZ2V0LmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldC5jb250ZW50V2luZG93KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldC5jb250ZW50V2luZG93KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKGUpIHtcbiAgICAgICAgdHJpZ2dlcihlLmRhdGEubWV0aG9kLCBlLmRhdGEucGFyYW1zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZW5kTWVzc2FnZShtZXRob2QsIGRhdGEpIHtcbiAgICAgICAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgICAgbWVzc2FnZS5wYXJhbXMgPSBkYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYocG9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBjYXRjaChpZ25vcmVkKSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB1bmhhbmRsZWRDYWxscy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkQ2FsbHMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyRXZlbnRzKGV2ZW50cykge1xuICAgICAgICBzZW5kTWVzc2FnZSgncmVnaXN0ZXInLCBldmVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgaWYobGlzdGVuZXJzW2V2ZW50XSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXSA9IHVuaGFuZGxlZEV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXS5wdXNoKGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0gPSBsaXN0ZW5lcnNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB3aGlsZSh1bmhhbmRsZWRFdmVudHNbZXZlbnRdICYmIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJpZ2dlcihldmVudCwgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5wb3AoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZWdpc3RlckV2ZW50cyhbZXZlbnRdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0aW9uIHRvIHRoZSBnYW1lIHVzaW5nIE1lc3NhZ2VDaGFubmVsXG4gICAgICogQGV4cG9ydHMgbm9saW1pdEFwaVxuICAgICAqL1xuICAgIHZhciBub2xpbWl0QXBpID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGxpc3RlbmVyIGZvciBldmVudCBmcm9tIHRoZSBzdGFydGVkIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIG9uXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgIGV2ZW50ICAgIG5hbWUgb2YgdGhlIGV2ZW50XG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGNhbGxiYWNrIGZvciB0aGUgZXZlbnQsIHNlZSBzcGVjaWZpYyBldmVudCBkb2N1bWVudGF0aW9uIGZvciBhbnkgcGFyYW1ldGVyc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiBhcGkub24oJ2RlcG9zaXQnLCBmdW5jdGlvbiBvcGVuRGVwb3NpdCAoKSB7XG4gICAgICAgICAqICAgICBzaG93RGVwb3NpdCgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAqICAgICAgICAgLy8gYXNrIHRoZSBnYW1lIHRvIHJlZnJlc2ggYmFsYW5jZSBmcm9tIHNlcnZlclxuICAgICAgICAgKiAgICAgICAgIGFwaS5jYWxsKCdyZWZyZXNoJyk7XG4gICAgICAgICAqICAgICB9KTtcbiAgICAgICAgICogfSk7XG4gICAgICAgICAqL1xuICAgICAgICBvbjogb24sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGwgbWV0aG9kIGluIHRoZSBvcGVuIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZCBuYW1lIG9mIHRoZSBtZXRob2QgdG8gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIG9wdGlvbmFsIGRhdGEgZm9yIHRoZSBtZXRob2QgY2FsbGVkLCBpZiBhbnlcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gcmVsb2FkIHRoZSBnYW1lXG4gICAgICAgICAqIGFwaS5jYWxsKCdyZWxvYWQnKTtcbiAgICAgICAgICovXG4gICAgICAgIGNhbGw6IHNlbmRNZXNzYWdlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcmlnZ2VycyBhIG5hbWVkIGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiB0cmlnZ2VyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAgbmFtZSBvZiB0aGUgZXZlbnRcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSBvcHRpb25hbCBkYXRhIGZvciB0aGUgZXZlbnQsIGlmIGFueVxuICAgICAgICAgKi9cbiAgICAgICAgdHJpZ2dlcjogdHJpZ2dlclxuICAgIH07XG5cbiAgICByZXR1cm4gbm9saW1pdEFwaTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdEFwaUZhY3Rvcnk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICdodG1sLCBib2R5IHtcXG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcXG4gICAgbWFyZ2luOiAwO1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAxMDAlO1xcbn1cXG5cXG5ib2R5IHtcXG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xcbn1cXG4nOyIsInZhciBsb2dIYW5kbGVyID0gcmVxdWlyZSgnLi9sb2ctaGFuZGxlcicpO1xubG9nSGFuZGxlci5zZXRFeHRyYSgnbm9saW1pdC5qcycsICcxLjIuNzInKTtcblxudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gcmVxdWlyZSgnLi9ub2xpbWl0LWFwaScpO1xudmFyIGluZm8gPSByZXF1aXJlKCcuL2luZm8nKTtcbnZhciBpb3NGdWxsc2NyZWVuID0gcmVxdWlyZSgnLi9pb3MtZnVsbHNjcmVlbicpO1xudmFyIGp1cmlzZGljdGlvblNFID0gcmVxdWlyZSgnLi9qdXJpc2RpY3Rpb24tc2UnKTtcblxudmFyIENETiA9ICdodHRwczovL3tFTlZ9JztcbnZhciBMT0FERVJfVVJMID0gJ3tDRE59L2xvYWRlci9sb2FkZXIte0RFVklDRX0uaHRtbD9vcGVyYXRvcj17T1BFUkFUT1J9JmdhbWU9e0dBTUV9Jmxhbmd1YWdlPXtMQU5HVUFHRX0nO1xudmFyIFJFUExBQ0VfVVJMID0gJ3tDRE59L2xvYWRlci9nYW1lLWxvYWRlci5odG1sP3tRVUVSWX0nO1xudmFyIEdBTUVTX1VSTCA9ICd7Q0ROfS9nYW1lcyc7XG5cbnZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgZGV2aWNlOiAnZGVza3RvcCcsXG4gICAgZW52aXJvbm1lbnQ6ICdwYXJ0bmVyJyxcbiAgICBsYW5ndWFnZTogJ2VuJyxcbiAgICAnbm9saW1pdC5qcyc6ICcxLjIuNzInXG59O1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRcbiAqL1xudmFyIG5vbGltaXQgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge1N0cmluZ30gdmVyc2lvbiBjdXJyZW50IHZlcnNpb24gb2Ygbm9saW1pdC5qc1xuICAgICAqL1xuICAgIHZlcnNpb246ICcxLjIuNzInLFxuXG4gICAgb3B0aW9uczoge30sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGxvYWRlciB3aXRoIGRlZmF1bHQgcGFyYW1ldGVycy4gQ2FuIGJlIHNraXBwZWQgaWYgdGhlIHBhcmFtZXRlcnMgYXJlIGluY2x1ZGVkIGluIHRoZSBjYWxsIHRvIGxvYWQgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgb3B0aW9ucy5vcGVyYXRvciB0aGUgb3BlcmF0b3IgY29kZSBmb3IgdGhlIG9wZXJhdG9yXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5sYW5ndWFnZT1cImVuXCJdIHRoZSBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5kZXZpY2U9ZGVza3RvcF0gdHlwZSBvZiBkZXZpY2U6ICdkZXNrdG9wJyBvciAnbW9iaWxlJy4gUmVjb21tZW5kZWQgdG8gYWx3YXlzIHNldCB0aGlzIHRvIG1ha2Ugc3VyZSB0aGUgY29ycmVjdCBkZXZpY2UgaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgdGhlIG5hbWUgb2YgYSBwcm9kdWN0aW9uIGVudmlyb25tZW50LiBUaGlzIG92ZXJyaWRlcyB0aGUgZW52aXJvbm1lbnQgcGFydCBvZiB0aGUgaG9zdG5hbWUuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5mdWxsc2NyZWVuPXRydWVdIHNldCB0byBmYWxzZSB0byBkaXNhYmxlIGF1dG9tYXRpYyBmdWxsc2NyZWVuIG9uIG1vYmlsZSAoQW5kcm9pZCBvbmx5KVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW29wdGlvbnMuY2xvY2s9dHJ1ZV0gc2V0IHRvIGZhbHNlIHRvIGRpc2FibGUgaW4tZ2FtZSBjbG9ja1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMucXVhbGl0eV0gZm9yY2UgYXNzZXQgcXVhbGl0eS4gUG9zc2libGUgdmFsdWVzIGFyZSAnaGlnaCcsICdtZWRpdW0nLCAnbG93Jy4gRGVmYXVsdHMgdG8gc21hcnQgbG9hZGluZyBpbiBlYWNoIGdhbWUuXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBbb3B0aW9ucy5qdXJpc2RpY3Rpb25dIGZvcmNlIGEgc3BlY2lmaWMganVyaXNkaWN0aW9uIHRvIGVuZm9yY2Ugc3BlY2lmaWMgbGljZW5zZSByZXF1aXJlbWVudHMgYW5kIHNldCBzcGVjaWZpYyBvcHRpb25zIGFuZCBvdmVycmlkZXMuIFNlZSBSRUFETUUgZm9yIGp1cmlzZGljdGlvbi1zcGVjaWZpYyBkZXRhaWxzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMuanVyaXNkaWN0aW9uLm5hbWVdIHRoZSBuYW1lIG9mIHRoZSBqdXJpc2RpY3Rpb24sIGZvciBleGFtcGxlIFwiTVRcIiwgXCJES1wiLCBcIkxWXCIsIFwiUk9cIiwgXCJVS0dDXCIsIFwiUFRcIiwgXCJFU1wiLCBcIklUXCIgb3IgXCJTRVwiLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMucmVhbGl0eUNoZWNrXSBzZXQgb3B0aW9ucyBmb3IgcmVhbGl0eSBjaGVjay4gU2VlIFJFQURNRSBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLmVuYWJsZWQ9dHJ1ZV0gc2V0IHRvIGZhbHNlIHRvIGRpc2FibGUgcmVhbGl0eS1jaGVjayBkaWFsb2cuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2suaW50ZXJ2YWw9NjBdIEludGVydmFsIGluIG1pbnV0ZXMgYmV0d2VlbiBzaG93aW5nIHJlYWxpdHktY2hlY2sgZGlhbG9nLlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLnNlc3Npb25TdGFydD1EYXRlLm5vdygpXSBvdmVycmlkZSBzZXNzaW9uIHN0YXJ0LCBkZWZhdWx0IGlzIERhdGUubm93KCkuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2submV4dFRpbWVdIG5leHQgdGltZSB0byBzaG93IGRpYWxvZywgZGVmYXVsdHMgdG8gRGF0ZS5ub3coKSArIGludGVydmFsLlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLmJldHM9MF0gc2V0IGluaXRpYWwgYmV0cyBpZiBwbGF5ZXIgYWxyZWFkeSBoYXMgYmV0cyBpbiB0aGUgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gIFtvcHRpb25zLnJlYWxpdHlDaGVjay53aW5uaW5ncz0wXSBzZXQgaW5pdGlhbCB3aW5uaW5ncyBpZiBwbGF5ZXIgYWxyZWFkeSBoYXMgd2lubmluZ3MgaW4gdGhlIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2subWVzc2FnZV0gTWVzc2FnZSB0byBkaXNwbGF5IHdoZW4gZGlhbG9nIGlzIG9wZW5lZC4gQSBnZW5lcmljIGRlZmF1bHQgaXMgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5wbGF5Rm9yRnVuQ3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2Ugd2hlbiBpbiBwbGF5aW5nIGZvciBmdW4gbW9kZS4gVXNlcyBFVVIgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmF1dG9wbGF5PXRydWVdIHNldCB0byBmYWxzZSB0byBkaXNhYmxlIGFuZCByZW1vdmUgdGhlIGF1dG8gcGxheSBidXR0b24uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5pdCh7XG4gICAgICogICAgb3BlcmF0b3I6ICdTTU9PVEhPUEVSQVRPUicsXG4gICAgICogICAgbGFuZ3VhZ2U6ICdzdicsXG4gICAgICogICAgZGV2aWNlOiAnbW9iaWxlJyxcbiAgICAgKiAgICBlbnZpcm9ubWVudDogJ3BhcnRuZXInLFxuICAgICAqICAgIGN1cnJlbmN5OiAnU0VLJyxcbiAgICAgKiAgICBqdXJpc2RpY3Rpb246IHtcbiAgICAgKiAgICAgICAgbmFtZTogJ1NFJ1xuICAgICAqICAgIH0sXG4gICAgICogICAgcmVhbGl0eUNoZWNrOiB7XG4gICAgICogICAgICAgIGludGVydmFsOiAzMFxuICAgICAqICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIGxvZ0hhbmRsZXJPcHRpb25zKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUsIHJlcGxhY2luZyB0YXJnZXQgd2l0aCB0aGUgZ2FtZS5cbiAgICAgKlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgSFRNTCBlbGVtZW50LCBpdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gaWZyYW1lLCBrZWVwaW5nIGFsbCB0aGUgYXR0cmlidXRlcyBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCwgc28gdGhvc2UgY2FuIGJlIHVzZWQgdG8gc2V0IGlkLCBjbGFzc2VzLCBzdHlsZXMgYW5kIG1vcmUuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBXaW5kb3cgZWxlbWVudCwgdGhlIGdhbWUgd2lsbCBiZSBsb2FkZWQgZGlyZWN0bHkgaW4gdGhhdC5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgZGVmYXVsdCB0byB0aGUgY3VycmVudCB3aW5kb3cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdEcmFnb25UcmliZScgb3IgJ1dpeHgnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMuaGlkZUN1cnJlbmN5XSBoaWRlIGN1cnJlbmN5IHN5bWJvbHMvY29kZXMgaW4gdGhlIGdhbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtub2xpbWl0QXBpfSAgICAgICAgVGhlIEFQSSBjb25uZWN0aW9uIHRvIHRoZSBvcGVuZWQgZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ0RyYWdvblRyaWJlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGxvZ0hhbmRsZXJPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICBqdXJpc2RpY3Rpb25TRS50YWtlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICBzdGFydExvYWRMb2coKTtcblxuICAgICAgICB2YXIgdGFyZ2V0ID0gb3B0aW9ucy50YXJnZXQgfHwgd2luZG93O1xuXG4gICAgICAgIGlmKHRhcmdldC5XaW5kb3cgJiYgdGFyZ2V0IGluc3RhbmNlb2YgdGFyZ2V0LldpbmRvdykge1xuICAgICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKCdzdHlsZScsICdwb3NpdGlvbjogZml4ZWQ7IHRvcDogMDsgbGVmdDogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb3ZlcmZsb3c6IGhpZGRlbjsnKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGFyZ2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRhcmdldC5vd25lckRvY3VtZW50ICYmIHRhcmdldCBpbnN0YW5jZW9mIHRhcmdldC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LkhUTUxFbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgaWZyYW1lID0gbWFrZUlmcmFtZSh0YXJnZXQpO1xuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGlmcmFtZSwgdGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIG5vbGltaXRBcGkgPSBub2xpbWl0QXBpRmFjdG9yeShpZnJhbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGh0bWwoaWZyYW1lLmNvbnRlbnRXaW5kb3csIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmcmFtZS5jb250ZW50V2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2dIYW5kbGVyLnNlbmRFcnJvcihlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBub2xpbWl0QXBpLm9uKCdleHRlcm5hbCcsIGZ1bmN0aW9uKGV4dGVybmFsKSB7XG4gICAgICAgICAgICAgICAgaWYoZXh0ZXJuYWwubmFtZSA9PT0gJ2hhbHQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBiZXRFdmVudHMgPSBsb2dIYW5kbGVyLmdldEV2ZW50cygnYmV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdub2xpbWl0LmpzIGhhbHQnLCBiZXRFdmVudHMpO1xuICAgICAgICAgICAgICAgICAgICBpZihiZXRFdmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dIYW5kbGVyLnNlbmRMb2coJ05PX0JFVFNfUExBQ0VEJywge21lc3NhZ2U6ICdHYW1lIGNsb3NlZCB3aXRoIG5vIGJldHMnfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYoZXh0ZXJuYWwubmFtZSA9PT0nYmV0Jykge1xuICAgICAgICAgICAgICAgICAgICBsb2dIYW5kbGVyLnN0b3JlRXZlbnQoJ2JldCcsIGV4dGVybmFsLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihleHRlcm5hbC5uYW1lID09PSdyZWFkeScpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSGFuZGxlci5zZXRFeHRyYSgnbG9hZFRpbWUnLCBEYXRlLm5vdygpIC0gc3RhcnRUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbm9saW1pdEFwaS5vbignaW50cm8nLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpb3NGdWxsc2NyZWVuLmluaXQob3B0aW9ucywgaWZyYW1lLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG5vbGltaXRBcGkub24oJ2ludHJvJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAganVyaXNkaWN0aW9uU0UuaW5pdChvcHRpb25zLCBpZnJhbWUuY29udGVudFdpbmRvdy5kb2N1bWVudCwgbm9saW1pdEFwaSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG5vbGltaXRBcGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBvcHRpb24gdGFyZ2V0OiAnICsgdGFyZ2V0O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSBpbiBhIG5ldywgc2VwYXJhdGUgcGFnZS4gVGhpcyBvZmZlcnMgdGhlIGJlc3QgaXNvbGF0aW9uLCBidXQgbm8gY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBnYW1lIGlzIHBvc3NpYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnRHJhZ29uVHJpYmUnIG9yICdXaXh4J1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudG9rZW5dIHRoZSB0b2tlbiB0byB1c2UgZm9yIHJlYWwgbW9uZXkgcGxheVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMubXV0ZT1mYWxzZV0gc3RhcnQgdGhlIGdhbWUgd2l0aG91dCBzb3VuZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudmVyc2lvbl0gZm9yY2Ugc3BlY2lmaWMgZ2FtZSB2ZXJzaW9uIHN1Y2ggYXMgJzEuMi4zJywgb3IgJ2RldmVsb3BtZW50JyB0byBkaXNhYmxlIGNhY2hlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5oaWRlQ3VycmVuY3ldIGhpZGUgY3VycmVuY3kgc3ltYm9scy9jb2RlcyBpbiB0aGUgZ2FtZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMubG9iYnlVcmw9XCJoaXN0b3J5OmJhY2soKVwiXSBVUkwgdG8gcmVkaXJlY3QgYmFjayB0byBsb2JieSBvbiBtb2JpbGUsIGlmIG5vdCB1c2luZyBhIHRhcmdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuZGVwb3NpdFVybF0gVVJMIHRvIGRlcG9zaXQgcGFnZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0IGVsZW1lbnRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnN1cHBvcnRVcmxdIFVSTCB0byBzdXBwb3J0IHBhZ2UsIGlmIG5vdCB1c2luZyBhIHRhcmdldCBlbGVtZW50XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5kZXBvc2l0RXZlbnRdIGluc3RlYWQgb2YgdXNpbmcgVVJMLCBlbWl0IFwiZGVwb3NpdFwiIGV2ZW50IChzZWUgZXZlbnQgZG9jdW1lbnRhdGlvbilcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmxvYmJ5RXZlbnRdIGluc3RlYWQgb2YgdXNpbmcgVVJMLCBlbWl0IFwibG9iYnlcIiBldmVudCAoc2VlIGV2ZW50IGRvY3VtZW50YXRpb24pIChtb2JpbGUgb25seSlcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLmFjY291bnRIaXN0b3J5VXJsXSBVUkwgdG8gc3VwcG9ydCBwYWdlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXQgZWxlbWVudFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXBpID0gbm9saW1pdC5yZXBsYWNlKHtcbiAgICAgKiAgICBnYW1lOiAnRHJhZ29uVHJpYmUnLFxuICAgICAqICAgIHRhcmdldDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKSxcbiAgICAgKiAgICB0b2tlbjogcmVhbE1vbmV5VG9rZW4sXG4gICAgICogICAgbXV0ZTogdHJ1ZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHJlcGxhY2U6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgbG9nSGFuZGxlck9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHN0YXJ0TG9hZExvZygpO1xuICAgICAgICBsb2NhdGlvbi5ocmVmID0gdGhpcy51cmwob3B0aW9ucyk7XG5cbiAgICAgICAgZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7b246IG5vb3AsIGNhbGw6IG5vb3B9O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RzIGEgVVJMIGZvciBtYW51YWxseSBsb2FkaW5nIHRoZSBnYW1lIGluIGFuIGlmcmFtZSBvciB2aWEgcmVkaXJlY3QuXG5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBzZWUgcmVwbGFjZSBmb3IgZGV0YWlsc1xuICAgICAqIEBzZWUge0BsaW5rIG5vbGltaXQucmVwbGFjZX0gZm9yIGRldGFpbHMgb24gb3B0aW9uc1xuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1cmw6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdhbWVPcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICBsb2dIYW5kbGVyT3B0aW9ucyhnYW1lT3B0aW9ucyk7XG4gICAgICAgIHZhciBnYW1lVXJsID0gUkVQTEFDRV9VUkxcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7Q0ROfScsIGdhbWVPcHRpb25zLmNkbilcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7UVVFUll9JywgbWFrZVF1ZXJ5U3RyaW5nKGdhbWVPcHRpb25zKSk7XG4gICAgICAgIHJldHVybiBnYW1lVXJsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGluZm9ybWF0aW9uIGFib3V0IHRoZSBnYW1lLCBzdWNoIGFzOiBjdXJyZW50IHZlcnNpb24sIHByZWZlcnJlZCB3aWR0aC9oZWlnaHQgZXRjLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgdGhlIG5hbWUgb2YgYSBwcm9kdWN0aW9uIGVudmlyb25tZW50LiBUaGlzIG92ZXJyaWRlcyB0aGUgZW52aXJvbm1lbnQgcGFydCBvZiB0aGUgaG9zdG5hbWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0RyYWdvblRyaWJlJyBvciAnV2l4eCdcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyB2ZXJzaW9uIG9mIGdhbWUgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICBjYWxsYmFjayAgY2FsbGVkIHdpdGggdGhlIGluZm8gb2JqZWN0LCBpZiB0aGVyZSB3YXMgYW4gZXJyb3IsIHRoZSAnZXJyb3InIGZpZWxkIHdpbGwgYmUgc2V0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5mbyh7Z2FtZTogJ0RyYWdvblRyaWJlJ30sIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgKiAgICAgdmFyIHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyk7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS53aWR0aCA9IGluZm8uc2l6ZS53aWR0aCArICdweCc7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS5oZWlnaHQgPSBpbmZvLnNpemUuaGVpZ2h0ICsgJ3B4JztcbiAgICAgKiAgICAgY29uc29sZS5sb2coaW5mby5uYW1lLCBpbmZvLnZlcnNpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluZm86IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGxvZ0hhbmRsZXJPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICBpbmZvLmxvYWQob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIGxvZ0hhbmRsZXJPcHRpb25zKG9wdGlvbnMpIHtcbiAgICBsb2dIYW5kbGVyLnNldEV4dHJhcyh7XG4gICAgICAgIG9wZXJhdG9yOiBvcHRpb25zLm9wZXJhdG9yLFxuICAgICAgICBkZXZpY2U6IG9wdGlvbnMuZGV2aWNlLFxuICAgICAgICB0b2tlbjogb3B0aW9ucy50b2tlbixcbiAgICAgICAgZ2FtZTogb3B0aW9ucy5nYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogb3B0aW9ucy5lbnZpcm9ubWVudFxuICAgIH0pO1xufVxuXG52YXIgc3RhcnRUaW1lO1xuZnVuY3Rpb24gc3RhcnRMb2FkTG9nKCkge1xuICAgIHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG59XG5cbmZ1bmN0aW9uIG1ha2VRdWVyeVN0cmluZyhvcHRpb25zKSB7XG4gICAgdmFyIHF1ZXJ5ID0gW107XG4gICAgZm9yKHZhciBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgICB2YXIgdmFsdWUgPSBvcHRpb25zW2tleV07XG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHF1ZXJ5LnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5LmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gbWFrZUlmcmFtZShlbGVtZW50KSB7XG4gICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGNvcHlBdHRyaWJ1dGVzKGVsZW1lbnQsIGlmcmFtZSk7XG5cbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnYWxsb3dmdWxsc2NyZWVuJywgJycpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2FsbG93JywgJ2F1dG9wbGF5OyBmdWxsc2NyZWVuJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnc2FuZGJveCcsICdhbGxvdy1mb3JtcyBhbGxvdy1zY3JpcHRzIGFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXRvcC1uYXZpZ2F0aW9uIGFsbG93LXBvcHVwcycpO1xuXG4gICAgdmFyIG5hbWUgPSBnZW5lcmF0ZU5hbWUoaWZyYW1lLmdldEF0dHJpYnV0ZSgnbmFtZScpIHx8IGlmcmFtZS5pZCk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnbmFtZScsIG5hbWUpO1xuXG4gICAgcmV0dXJuIGlmcmFtZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKGdsb2JhbE9wdGlvbnMsIGdhbWVPcHRpb25zKSB7XG4gICAgZGVsZXRlIGdsb2JhbE9wdGlvbnMudmVyc2lvbjtcbiAgICBkZWxldGUgZ2xvYmFsT3B0aW9ucy5yZXBsYXk7XG4gICAgZGVsZXRlIGdsb2JhbE9wdGlvbnMudG9rZW47XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgbmFtZTtcbiAgICBmb3IobmFtZSBpbiBERUZBVUxUX09QVElPTlMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IERFRkFVTFRfT1BUSU9OU1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2FtZU9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdhbWVPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShyZXF1aXJlKCcuL25vbGltaXQuY3NzJykpKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBWaWV3cG9ydChoZWFkKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gaGVhZC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ2aWV3cG9ydFwiXScpO1xuICAgIGlmKCF2aWV3cG9ydCkge1xuICAgICAgICBoZWFkLmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgJzxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wLCBtYXhpbXVtLXNjYWxlPTEuMCwgdXNlci1zY2FsYWJsZT1ub1wiPicpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZGV2aWNlID0gb3B0aW9ucy5kZXZpY2UudG9Mb3dlckNhc2UoKTtcbiAgICBvcHRpb25zLm11dGUgPSBvcHRpb25zLm11dGUgfHwgZmFsc2U7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gb3B0aW9ucy5jZG4gfHwgQ0ROLnJlcGxhY2UoJ3tFTlZ9JywgZW52aXJvbm1lbnQpO1xuICAgIG9wdGlvbnMuc3RhdGljUm9vdCA9IG9wdGlvbnMuc3RhdGljUm9vdCB8fCBHQU1FU19VUkwucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbik7XG4gICAgb3B0aW9ucy5wbGF5Rm9yRnVuQ3VycmVuY3kgPSBvcHRpb25zLnBsYXlGb3JGdW5DdXJyZW5jeSB8fCBvcHRpb25zLmN1cnJlbmN5O1xuICAgIGlmIChvcHRpb25zLmxhbmd1YWdlID09PSAncGUnIHx8IG9wdGlvbnMubGFuZ3VhZ2UgPT09ICdjbCcpIHtcbiAgICAgICAgb3B0aW9ucy5sYW5ndWFnZSA9ICdlcyc7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBodG1sKHdpbmRvdywgb3B0aW9ucykge1xuICAgIHZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudDtcblxuICAgIHdpbmRvdy5mb2N1cygpO1xuXG4gICAgaW5zZXJ0Q3NzKGRvY3VtZW50KTtcbiAgICBzZXR1cFZpZXdwb3J0KGRvY3VtZW50LmhlYWQpO1xuXG4gICAgdmFyIGxvYWRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBsb2FkZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLndpZHRoID0gJzEwMHZ3JztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmhlaWdodCA9ICcxMDB2aCc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS56SW5kZXggPSAnMjE0NzQ4MzY0Nyc7XG4gICAgbG9hZGVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdsb2FkZXInKTtcblxuICAgIGxvYWRlckVsZW1lbnQuc3JjID0gTE9BREVSX1VSTFxuICAgICAgICAucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbilcbiAgICAgICAgLnJlcGxhY2UoJ3tERVZJQ0V9Jywgb3B0aW9ucy5kZXZpY2UpXG4gICAgICAgIC5yZXBsYWNlKCd7T1BFUkFUT1J9Jywgb3B0aW9ucy5vcGVyYXRvcilcbiAgICAgICAgLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tMQU5HVUFHRX0nLCBvcHRpb25zLmxhbmd1YWdlKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0hhbmRsZXIuc2VuZEVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQgJiYgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHsnZXJyb3InOiBlcnJvcn0pLCAnKicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBub2xpbWl0LmluZm8ob3B0aW9ucywgZnVuY3Rpb24oaW5mbykge1xuICAgICAgICAgICAgaWYoaW5mby5lcnJvcikge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdlcnJvcicsIGluZm8uZXJyb3IpO1xuICAgICAgICAgICAgICAgIGxvYWRlckVsZW1lbnQuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShpbmZvKSwgJyonKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2luZm8nLCBpbmZvKTtcblxuICAgICAgICAgICAgICAgIHZhciBnYW1lRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IGluZm8uc3RhdGljUm9vdCArICcvZ2FtZS5qcyc7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxvYWRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQgPSBub2xpbWl0O1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMudmVyc2lvbiA9IGluZm8udmVyc2lvbjtcblxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxvYWRlckVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBjb3B5QXR0cmlidXRlcyhmcm9tLCB0bykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZnJvbS5hdHRyaWJ1dGVzO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXTtcbiAgICAgICAgdG8uc2V0QXR0cmlidXRlKGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgfVxufVxuXG52YXIgZ2VuZXJhdGVOYW1lID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5hbWUgfHwgJ05vbGltaXQtJyArIGdlbmVyYXRlZEluZGV4Kys7XG4gICAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdDtcbiJdfQ==
