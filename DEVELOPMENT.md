# Development

## Publishing a new version

Make sure that Eslint runs cleanly:

    npm run lint

Commit all outstanding changes:

    git commit

Run tests and increment version number, possibly replacing `patch` with `minor` or `major`, see [npm-version](https://docs.npmjs.com/cli/version):

    npm version patch
    
Push to server:
    
    git push
    
Publish new version to <https://nolimitjs.nolimitcdn.com>:
   
    npm run www

Publish to <https://www.npmjs.com/~nolimit>:

    npm --userconfig=.npmrc login
    npm --userconfig=.npmrc publish --access public
    
* Login as `nolimit` and use email <buildbot@nolimitcity.com> (ask for password if you don't have it).
* `--userconfig=.npmrc` makes sure you don't pollute your regular `.npmrc`.

## Build locally

    npm run dist
    
Look in www/dist folder for the result (usually you want `nolimit-latest.js`)
