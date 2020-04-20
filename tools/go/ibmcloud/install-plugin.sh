#!/usr/bin/env bash

echo "Building and Installing ibmcloud kui plugin"

SCRIPTDIR=$(cd $(dirname "$0") && pwd)
cd "$SCRIPTDIR"

go build

ibmcloud plugin install ./kui
