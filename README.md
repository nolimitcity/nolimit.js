# nolimit.js

Javascript game loader and API for operators to load and  communicate with Nolimit games.

## Introduction

**nolimit.js** provides a powerful yet simple way to load games, while still putting most of the control in the hands of the operator.

The operator makes all the design and layout, and will only need to provide a target element for the loader to use.

## Get nolimit.js

**nolimit.js** is available with sourcemap and some logging as `nolimit-VERSION.js` or as minified as `nolimit-VERSION.min.js` at http://nolimitjs.nolimitcdn.com/.

It can also be installed using NPM:

    npm install --save @nolimit/nolimit.js

**nolimit.js** files are packaged as [UMD](https://github.com/umdjs/umd), meaning it can be loaded using [CommonJS](http://wiki.commonjs.org/wiki/CommonJS) such as [Browserify](http://browserify.org/), [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) such as [RequireJS](http://requirejs.org/) or just standalone with a regular `<script>` tag.

When loaded standalone, it will add a global variable `window.nolimit` which is used to load the games. See examples below.

### Using CommonJS

```javascript
var nolimit = require('@nolimit/nolimit.js');
nolimit.init({
    operator: 'SMOOTHOPERATOR'
});
```

### Using AMD

```javascript
define(['nolimit'], function(nolimit) {
    nolimit.init({
        operator: 'SMOOTHOPERATOR'
    });
});
```

### As a global variable

```html
<script src="https://nolimitjs.nolimitcdn.com/dist/nolimit-latest.min.js"></script>
<script>
nolimit.init({
    operator: 'SMOOTHOPERATOR'
});
</script>
```

### Using typescript

```typescript
import * as nolimit from '@nolimit/nolimit.js';
nolimit.init({
    operator: 'SMOOTHOPERATOR'
});
```

## API documentation

For more information on the available methods and options, see the [generated JSDOC](module-nolimit.html).

## Current version

```javascript
console.log('nolimit.js', nolimit.version);
```

## Loading a game

### As part of the page

Create an element, usually a `<div>`, that will be *replaced* by the game's `<iframe>`. The iframe will retain styling information such as `width` and `height`, `display` and so on.

```javascript
var api = nolimit.load({
    target: document.querySelector('#game'),
    game: gameName
});

api.on('exit', closeGame);
```

### Replace window

Common use case on mobile, where the game should fill the whole screen and you still want the back button to work.

```javascript
var api = nolimit.replace({
    game: gameName
});
```

This goes to a completely separate page, so listening to events are not possible. So to specify what to do on exit, deposit or support, it's instead possible to give URLs as parameters:

Exiting will still default to `history.back()` which will usually work in the common case.
 
```javascript
var api = nolimit.replace({
    game: gameName,
    lobbyUrl: lobbyUrl,
    supportUrl: supportUrl,
    depositUrl: depositUrl,
    accountHistoryUrl: accountHistoryUrl
});
```

It's also possible to make a full screen `<div>` and use that as target if that fits your flow better. Note though, that you need to make the game element responsive or resize manually in that case.

### Construct URL manually

If you wish to *not* make use of nolimit.js, but rather construct a URL, this is also possible:

The minimal URL that loads a game looks like: https://partner.nolimitcdn.com/loader/game-loader.html?game=GAME&operator=OPERATOR

To construct this URL manually:

1. Take all needed options as documented here and construct a query string by pairing `<key>=<value>` and joining them with `&`
    * It is highly recommended to URI-escape both keys and values
    * Some games need extra data that's not plain strings, these need to pass through a JSON serialization before being URL encoded
2. Append the query string to: `https://<environment>.nolimitcdn.com/loader/game-loader.html?`
    * `<environment>` is either `'partner'` for test environments, or the name for a specific production environment that you have gotten from us.

Note: `nolimit.url(options)` can build this URL for you if you use javascript, and `nolimit.replace(options)` can also redirect there.

#### Passing along option objects in the URL

Some objects can be passed along in the URL, e.g. `jurisdiction`. However, this needs to be encoded properly to be accepted. The value is added into to the options structure by decoding in the following way conceptually.

`options.value = JSON.parse(decodeURIComponent(value in url))`

So when adding the value to the URL first encode it in this way, where `{...}` represents the object you need to pass along.

`encodeURIComponent(JSON.stringify({...}))`

## Options

It's not strictly required to call `init()`, it's possible to call `load()` directly with all the options instead. `init()` just provides a way to setup some common defaults and the options will actually be merged before each game load.
 
The only required options are the **operator** code for init, the **game** code for game loading, and the **HTMLElement** or **Window** to replace.

### Supported languages

Option **language** defaults to `'en'`.

Currently supported values are `'en', 'da', 'de', 'es', 'fi', 'fr', 'is', 'ja', 'ko', 'lv', 'nl', 'no', 'pl', 'ru', 'sv', 'th', 'tr', 'vi', 'zh'`.

### Real money or play money

For playing with real money, a one time **token** is required, that is generated by the operator. The token will be verified via an API call to the operator's server. If the token is missing, fun mode is automatically enabled. If the token is present, but fails validation, there will be an error inside the game.

## Query information about the game

Ask environment for some information such as optimal game size and version number. Used internally by game loader and exposed here in case it's useful.

```javascript
nolimit.info({game: 'SpaceArcade'}, function(info) {
    var target = document.getElementById('game');
    target.style.width = info.size.width + 'px';
    target.style.height = info.size.height + 'px';
    console.log('Loading:', info.name, info.version);
});
```

## Communicating with the game

For more information on the available methods, see the [generated JSDOC](module-nolimitApi.html). Note that `replace()` does not return an API connection.

### Events

The operator can add callbacks for certain events, such as the player trying to close the game or do a deposit from within the game.

```javascript
var api = nolimit.load({
    game: gameName
});

api.on('intro', function onLoad() {
    // ...
});

api.on('ready', function onLoad() {
    // ...
});

api.on('exit', function goToLobby() {
    // ...
});

api.on('balance', function updateBalance(balance) {
    // ...
});

api.on('deposit', function openDeposit() {
    // ...
});

api.on('support', function openHelpChat() {
    // ...
});

api.on('accountHistory', function openAccountHistory() {
    // ...
});

api.on('error', function logError(message) {
    console.error('nolimit.js:', message);
});

api.on('info', function logInfo(info) {
    console.log('Loading:', info.name, info.version);
});
```

* intro - fired when the games intro screen is showing (for legacy reasons, it's similar to ready, below, API is also available at this point)
* ready - fired when the game is loaded and ready, and the API can be used.
* exit - (mobile only) fired when the player presses the exit button in the game.
* balance - fired when the game displays a new balance, with that balance as data to the callback. 
* deposit - fired when the player presses the Deposit button in the game.
* support - fired when the player presses the Support button in the game.
* accountHistory - fired when the player pushes the account history button on the reality check popup.
* error - fired when a fatal error has occured, with some error message as data to the callback.
* info - fired when loader has obtained information about the game, same as `nolimit.info()`.
* busy - game is currently spinning or should otherwise not be interrupted
* idle - game is idle and can be blocked by other UI

There may be more specific events for Jurisdictions and other special cases, see those specific parts.  

### Calling methods

The operator can also control the game using RPC calls:

```javascript
api.call('refresh');

api.call('pause');
api.call('resume');
```

* refresh - ask game to refresh balance from server
* pause - freeze the game
* resume - unfreeze the game

### If loading via url / launcher page

```javascript
window.addEventListener('message', function(e) {
    if(e.data) {
        console.log(e.data); // busy, idle, ready
    }
});

// iframe with the launcher URL 
var gameFrame = document.getElementById('game');
gameFrame.contentWindow.postMessage('pause', '*');
gameFrame.contentWindow.postMessage('resume', '*');

// To handle this way, use depositEvent=true and lobbyEvent=true instead of depositUrl and lobbyUrl, see game loading options
gameFrame.contentWindow.postMessage('deposit', '*');
gameFrame.contentWindow.postMessage('lobby', '*'); // this is the same as "exit" in regular api
```

## More Examples

### Opening a deposit dialog from the game

If the operator has added an event listener for the 'deposit' event, the game will offer the player an option to open this when they run out of money. After a successful deposit, the game can be asked to refresh the balance:

```javascript
api.on('deposit', function openDeposit () {
    showDeposit().then(function() {
        // ask the game to refresh balance from server
        api.call('refresh');
    });
});
```

## Pause/resume/busy/idle

The api can listen to events for when the game is busy/idle as well as call pause/resume. Game will usually be in "busy" state when doing a spin (or equivalent).

The usual use case for pausing is to show some operator-specific content. It is recommended to first wait for the game to be in "idle" state, then call "pause" and once done with the custom content, call "resume".

Game cannot be paused in the middle of a spin or other equivalent "busy" state, but will pause once "idle" state is reached. It is recommended to use the events to keep track of this for maximum control. 

```javascript
var busy = false;
api.on('busy', function() {busy = true;});
api.on('idle', function() {busy = false;});

// Pause the game at next possible time
api.call('pause');

// unpause the game
api.call('resume');
```

## Jurisdictions

Use `options.jurisdiction.name=<JURISDICTION CODE>` to override which jurisdiction's license that should be used.

Our supported jurisdictions: "DE", "DK", "LV", "RO", "SE", "UKGC", "MT", "LT"

Currently there is special behaviour in our games for jurisdictions `"DK", "LT", "UKGC"` (UK) and `"SE"` (Lotteriinspektionen, Sweden).

### UKGC, LT, DK, DE

No extra configuration needed.

### SE

Lotteriinspektionen has [three mandatory buttons](https://www.lotteriinspektionen.se/press/nyhetsarkiv/enklare-for-spelare-att-ta-kontroll-over-sitt-spelande/) that must be displayed for play in Sweden. Either the operator can show them on their site, but when this is impossible or impractical (say, on mobile) we can display these buttons in-game.

It may help the experience to set the option `fullscreen` to `false`; default enabled on Android mobile.  

There are currently two ways to configure these buttons:

#### Configure as regular links:

On top of setting `jurisdiction.name` to `"SE"`, the three buttons each need a URL to corresponding pages maintained by the operator. Add them to the jurisdiction object when setting jurisdiction 'SE'. They are named after the icon names, see the documentation from Lotteriinspektionen.

Optionally, you can also add a [`target` for the links](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-target), default is `"_top"`, replacing the current site. To open in a new tab/window, set it to `"_blank"` or see HTML documentation for more options. 

```javascript
{
    options.jurisdiction = {
        name: 'SE',
        target: '_top',
        spelpaus: '<URL>',
        spelgranser: '<URL>',
        sjalvtest: '<URL>'
    }
}
```

#### Configure as events:

Use the external API to get callbacks:

```javascript
api.on('spelgranser', function() {
    // ...
});

api.on('spelpaus', function() {
    // ...
});

api.on('sjalvtest', function() {
    // ...
});

{
    options.jurisdiction = {
        name: 'SE',
        events: true
    }
}
```


## Reality Check

At regular intervals (default once per hour), a dialog is shown to the player, listing time elapsed, bets and wins during the game session and an option to close the game.

Interval, message and intial values can all be changed, or it can be completely disabled. See the javascript options for `nolimit.init()`. It is also possible to update these values via the server-to-server API, see integration documentation.


## How do I...?

### Style the game iframe

For instance, set the initial background color, width/height etc.

Style the original element (probably a `<div>`). Note that if you do this with CSS, the tag will be `iframe`, so this selector will not work:

```css
div.game {...}
```

but any of these will:

```css
div.game, iframe.game {...}

.game {...}
```
