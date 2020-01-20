#!/usr/bin/env bash

#
# Starts up webpack-dev-server for local development of webpack clients in the monorepo
#
# Options:
#   - CLIENT=alternate|default as an environment variable, you may specify a directory in clients/
#

set -e
set -o pipefail

export CLIENT=${CLIENT-default}
CLIENT_DEFN_PLUGIN=`cat clients/"$CLIENT"/package.json | jq --raw-output .kui.client`
THEME=$(cd node_modules/@kui-shell/client && pwd)

# rebuild the html in case the user has changed CLIENT
npm run build:html

# rebuild the node-pty native code, in case the user is switching from
# electron to webpack (each of which may use a different node ABI)
if [ "$TARGET" = "electron-renderer" ]; then
    npm run pty:electron
else
    npm run pty:nodejs
fi

# npm install the webpack support, if we haven't already done so (we
# forgo installing the webpack components initially, due to their
# size)
if [ ! -d node_modules/webpack ]; then
    npm install --no-save --ignore-scripts --no-package-lock ./packages/webpack
fi

if [ "$TARGET" = "electron-renderer" ]; then
    TARGETDIR=dist/electron/build
else
    TARGETDIR=dist/webpack/build
fi

# for development purposes, we will need to do a bit of hackery to
# link in the CLIENT theming into the dist/webpack staging area
rm -rf clients/$CLIENT/$TARGETDIR
mkdir -p clients/$CLIENT/$TARGETDIR/css

(cd clients/$CLIENT/$TARGETDIR && \
     ln -sf "$THEME"/icons && \
     ln -sf "$THEME"/images && \
     cd css && \
     for i in ../../../../../../packages/core/web/css/*; do ln -sf $i; done && \
     for i in "$THEME"/css/*; do ln -sf $i; done \
    )

# link in any config.json settings that the CLIENT definition may specify
(cd node_modules/@kui-shell/settings && \
     rm -f config-dev.json; if [ -f "$THEME"/config.d/config.json ]; then echo "linking config-dev.json"; cp "$THEME"/config.d/config.json config-dev.json; fi)

# display extra build progress?
if [ -z "$TRAVIS_JOB_ID" ]; then
    PROGRESS="--progress"
fi

export KUI_MONO_HOME=$(cd ./ && pwd)

# make sure everything is compiled for ES Modules; do this
# synchronously!
npm run compile:source:es6

# then, launch an ES Module compilation watcher in the background; why
# do we need to watch on our own? why doesn't ts-loader do this for
# us? not sure, probably a bug in ts-loader:
# https://github.com/TypeStrong/ts-loader/issues/1042 (note how we
# make sure to terminate the watcher when we are terminated)
tsc --build tsconfig-es6.json --watch &
WATCH=$!
trap ctrl_c INT
trap ctrl_c EXIT
function ctrl_c() {
    kill $WATCH
}

# we use this to tell the dev server to touch a lock file when it is
# done; below, we will poll until that is the case
export LOCKFILE=/tmp/kui-build-lock.${PORT_OFFSET-0}
rm -f $LOCKFILE

# launch webpack-dev-server
webpack-dev-server $PROGRESS --config packages/webpack/webpack.config.js &

# but don't exit until the dev server is ready
until [ -f $LOCKFILE ]; do sleep 1; done
rm -f $LOCKFILE
