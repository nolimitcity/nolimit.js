# nolimit.js

Javascript game loader and API for operators to load and  communicate with Nolimit games.

## Introduction

**nolimit.js** provides a powerful yet simple way to load games, while still putting most of the control in the hands of the operator.

The operator makes all the design and layout, and will only need to provide a target element for the loader to use.

## Get nolimit.js

**nolimit.js** is available with sourcemap and some logging as `nolimit-VERSION.js` or as minified as `nolimit-VERSION.min.js` at http://nolimitcity.github.io/nolimit.js/.

It can also be installed using NPM:

    npm install --save @nolimit/nolimit.js

**nolimit.js** files are packaged as [UMD](https://github.com/umdjs/umd), meaning it can be loaded using [CommonJS](http://wiki.commonjs.org/wiki/CommonJS) such as [Browserify](http://browserify.org/), [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) such as [RequireJS](http://requirejs.org/) or just standalone with a regular `<script>` tag.

When loaded standalone, it will add a global variable `window.nolimit` which is used to load the games. See examples below.

### Using CommonJS

```javascript
var nolimit = require('nolimit');
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
<script src="https://nolimitcity.github.io/nolimit.js/dist/nolimit-latest.min.js"></script>
<script>
nolimit.init({
    operator: 'SMOOTHOPERATOR'
});
</script>
```

## API documentation

For more information on the available methods, see the [generated JSDOC](module-nolimit.html).

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

Make a separate page which contains the game loading script and navigate to that. `nolimit.load()` will default to replacing the whole current window.

```javascript
var api = nolimit.load({
    game: gameName
});

api.on('exit', function() {
    // or go to specific lobby page, or any other special handling
    history.back();
});
```

It's also possible to make a full screen `<div>` and use that as target if that fits your flow better. Note though, that you need to make the game element responsive or resize manually in that case.

## Options

It's not strictly required to call `init()`, it's possible to call `load()` directly with all the options instead. `init()` just provides a way to setup some common defaults and the options will actually be merged before each game load.
 
The only required options are the **operator** code for init, the **game** code for game loading, and the **HTMLElement** or **Window** to replace.

### Real money or play money

For playing with real money, a one time **token** is required, that is generated by the operator. The token will be verified via an API call to the operator's server. If the token is missing, fun mode is automatically enabled. If the token is present, but fails validation, there will be an error inside the game.

## Query information about the game

Ask environment for some information such as optimal game size and version number. Used internally by game loader and exposed here in case it's useful.

```javascript
nolimit.info({game: 'SpaceArcade'}, function(info) {
    var target = document.getElementById('game');
    target.style.width = info.size.width;
    target.style.height = info.size.height;
    console.log('Loading:', info.name, info.version);
});
```

## Communicating with the game

For more information on the available methods, see the [generated JSDOC](module-nolimitApi.html).

### Events

The operator can add callbacks for certain events, such as the player trying to close the game or do a deposit from within the game.

```javascript
var api = nolimit.load({
    game: gameName
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
```

* ready - fired when the game is loaded and ready, and the API can be used.
* exit - (mobile only) fired when the player presses the exit button in the game.
* balance - fired when the game displays a new balance, with that balance as in-parameter. 
* deposit - fired when the player presses the Deposit button in the game.
* support - fired when the player presses the Support button in the game.

### Calling methods

The operator can also control the game using RPC calls:

```javascript
api.call('refresh');

api.call('reload');
```

* refresh - ask game to refresh balance from server
* reload - reload the game

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

### Multiple games

```html
<div class="multigame">
    <div id="game1">
    <div id="game2">
</div>
```

```javascript
nolimit.init({
    operator: 'SMOOTHOPERATOR',
    language: 'sv',
    environment: 'production'
});

var gameElement1 = document.getElementById('game1');
nolimit.load({
    target: gameElement1,
    game: 'KitchenDrama'
});

var gameElement2 = document.getElementById('game2');
nolimit.load({
    target: gameElement2,
    game: 'CreepyCarnival'
});

```

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

## Development

### Publishing a new version

Make sure that JSHint runs cleanly:

    npm run lint

Commit all outstanding changes:

    git commit

Run tests and increment version number, possibly replacing `patch` with `minor` or `major`, see [npm-version](https://docs.npmjs.com/cli/version):

    npm version patch
    
Push to server:
    
    git push
    
Publish new version to <http://nolimitcity.github.io/nolimit.js>:
   
    npm run www
