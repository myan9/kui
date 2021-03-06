/*
 * Copyright 2018 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs')
const path = require('path')

const mode = process.env.MODE || 'development'
const target = process.env.HEADLESS_TARGET || 'node'
const TerserJSPlugin = require('terser-webpack-plugin')
const { IgnorePlugin } = require('webpack')

// this lets us create a headless.zip file
const ZipPlugin = require('zip-webpack-plugin')

// in case the client has some oddities that require classnames to be preserved
const terserOptions = process.env.KEEP_CLASSNAMES
  ? {
      terserOptions: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        keep_classnames: true
      }
    }
  : {}

const optimization = {}
if (process.env.NO_OPT) {
  console.log('optimization? disabled')
  optimization.minimize = false
} else {
  optimization.minimizer = [new TerserJSPlugin(terserOptions)]
}

console.log('mode?', mode)
console.log('target?', target)

/** point webpack to the output directory */
const buildDir = path.join(process.env.CLIENT_HOME, 'dist/headless')
console.log('buildDir', buildDir)

/** this is the full path in which will be serving up bundles */
const outputPath = buildDir
console.log('outputPath', outputPath)

/**
 * Note: these are _webpack plugins_ not Kui plugins; we will assemble
 * this list of webpack plugins as we go.
 */
const plugins = []

// ignore these bits for headless
plugins.push(new IgnorePlugin({ contextRegExp: /\/tests\// }))
plugins.push(new IgnorePlugin({ contextRegExp: /\/@kui-shell\/build/ }))
;[
  /^d3$/,
  /^elkjs\/lib\/elk.bundled.js$/,
  /^react$/,
  /^jquery$/,
  /^electron$/,
  /^monaco-editor$/,
  /^@patternfly\/react-core$/,
  /^@patternfly\/react-chart$/,
  /^@patternfly\/react-table$/
].forEach(resourceRegExp => plugins.push(new IgnorePlugin({ resourceRegExp })))
;[
  /plugin-wskflow/,
  /plugin-\w+-themes/,
  /plugin-client-common/,
  // /plugin-kubectl-flow-views/,
  /plugin-electron-components/
].forEach(resourceRegExp => plugins.push(new IgnorePlugin({ resourceRegExp, contextRegExp: /@kui-shell/ })))

/**
 * Define the set of bundle entry points; there is one default entry
 * point (the main: entry below). On top of this, we scan the plugins,
 * looking to see if they define a `webpack.entry` field in their
 * package.json; if so, we add this to the mix. See plugin-editor for
 * an example of this.
 *
 */
const main = path.join(process.env.CLIENT_HOME, 'node_modules/@kui-shell/core/mdist/main/main.js')
const pluginBase = path.join(process.env.CLIENT_HOME, 'node_modules/@kui-shell')
console.log('main', main)
console.log('pluginBase', pluginBase)
const allKuiPlugins = fs.readdirSync(pluginBase)
const kuiPluginRules = []
const kuiPluginExternals = []
allKuiPlugins.forEach(dir => {
  try {
    const pjson = path.join(pluginBase, dir, 'package.json')
    const { kui } = require(pjson)
    const providedEntries = (kui && kui.webpack && kui.webpack.entry) || {}

    // does the kui plugin need any webpack plugins?
    if (kui && kui.webpack) {
      if (kui.webpack.externals) {
        kui.webpack.externals.forEach(_ => {
          kuiPluginExternals.push(_)
        })
      }

      if (kui.webpack.rules) {
        if (kui.webpack.rules['file-loader']) {
          kui.webpack.rules['file-loader'].forEach(test => {
            kuiPluginRules.push({
              test: new RegExp(test.replace(/(\S)\/(\S)/g, `$1\\${path.sep}$2`)),
              use: 'file-loader'
            })
          })
        }
      }
    }

    return providedEntries
  } catch (err) {
    return {}
  }
})
const entry = main
console.log('entry', entry)

const { productName } = require('@kui-shell/client/config.d/name.json')
console.log(`productName=${productName}`)

//
// touch the LOCKFILE when we are done
//
plugins.push({
  apply: compiler => {
    compiler.hooks.done.tap('done', () => {
      // touch the lockfile to indicate that we are done
      try {
        if (process.env.LOCKFILE) {
          fs.closeSync(fs.openSync(process.env.LOCKFILE, 'w'))
        }
      } catch (err) {
        console.error(err)
        throw err
      }
    })
  }
})

// zip after emit, so we get a dist/headless.zip
plugins.push(
  new ZipPlugin({
    filename: 'headless.zip', // ZipPlugin by default names it based on the name of the main bundle
    path: '..', // ZipPlugin seems to treat this as relative to the output path specified below
    include: /.*/ // ZipPlugin by default only includes the main bundle file
  })
)

// console.log('webpack plugins', plugins)

// Notes: we want to pull
// node-pty in as a commonjs external module; this
// is because node-pty has binary bits, and we are building one set of
// bundles for all electron platforms. If, in the future, we decide to
// rebuild the bundles for each platform, we can remove this 'commonjs
// node-pty...' bit, and, below, restore the `rule` pertaining to
// node-pty (i will leave that rule in the code here, for now, though
// commented out; just make sure to remove the commonjs bit here, and
// uncomment the node-pty rule below, if you decide to rebuild the
// bundles, once for each platform, in the future). The kui issue
// covering this topic is here:
// https://github.com/IBM/kui/issues/3381; and if you're curious about
// the 'commonjs node-pty' syntax, see
// https://github.com/webpack/webpack/issues/4238
const externals = [
  /* 'd3',
  'elkjs',
  'react',
  'jquery',
  'electron',
  'monaco-editor',
  '@patternfly/react-core': '',
  '@patternfly/react-chart',
  '@patternfly/react-table', */
  { 'node-pty': 'commonjs node-pty' }
]

kuiPluginExternals.forEach(_ => {
  externals[_] = _
})

module.exports = {
  context: process.env.CLIENT_HOME,
  stats: {
    // while developing, you should set this to true
    warnings: false
  },
  entry,
  target,
  mode,
  node: {
    __filename: true,
    __dirname: true
  },
  externals,
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  optimization,
  module: {
    rules: kuiPluginRules.concat([
      // ignore commonjs bits
      {
        test: new RegExp(`\\${path.sep}node_modules\\${path.sep}@kui-shell\\${path.sep}\\.*\\${path.sep}dist`),
        use: 'ignore-loader'
      },
      {
        test: /\.css$/i,
        use: 'ignore-loader'
      },
      {
        test: /\.scss$/i,
        use: 'ignore-loader'
      },
      {
        test: /\.(eot)$/i,
        use: 'ignore-loader'
      },
      {
        test: /\.(ttf)$/i,
        use: 'file-loader'
      },
      {
        test: /\.(woff2?)$/i,
        use: 'file-loader'
      },

      //
      // typescript exclusion rules
      { test: /\/node_modules\/typescript\//, use: 'ignore-loader' },
      { test: /\/node_modules\/proxy-agent\//, use: 'ignore-loader' },
      { test: /\/node_modules\/@types\//, use: 'ignore-loader' },
      // end of typescript rules
      { test: /\/terser\/tools/, use: 'ignore-loader' },
      { test: /beautify-html\.js/, use: 'ignore-loader' },
      { test: /jquery\.map/, use: 'ignore-loader' },
      { test: /sizzle\.min\.map/, use: 'ignore-loader' },
      { test: /\/modules\/queue-view\//, use: 'ignore-loader' },
      { test: /\/node_modules\/proxy-agent\//, use: 'ignore-loader' },
      // { test: /\/node_modules\/fsevents\//, use: 'ignore-loader' },
      { test: /\/node_modules\/nan\//, use: 'ignore-loader' },
      { test: /translation-demo\/composition.js$/, use: 'ignore-loader' },
      { test: /\.DOCS/, use: 'ignore-loader' },
      { test: /plugins\/*\/node_modules/, use: 'ignore-loader' },
      { test: /packages\/*\/node_modules/, use: 'ignore-loader' },
      // { test: /modules\/composer\/@demos\/.*\.js/, use: 'raw-loader' },
      // DANGEROUS: some node modules must have critical files under src/: { test: /\/src\//, use: 'ignore-loader' },
      // { test: /\/test\//, use: 'ignore-loader' },
      { test: /AUTHORS/, use: 'ignore-loader' },
      { test: /LICENSE/, use: 'ignore-loader' },
      { test: /license.txt/, use: 'ignore-loader' },

      // was: file-loader; but that loader does not allow for dynamic
      // loading of markdown *content* in a browser-based client
      { test: /\.md$/, use: 'raw-loader' },
      { test: /\.markdown$/, use: 'raw-loader' },
      { test: /CHANGELOG\.md$/, use: 'ignore-loader' }, // too big to pull in to the bundles

      { test: /~$/, use: 'ignore-loader' },
      { test: /Dockerfile$/, use: 'ignore-loader' },
      { test: /flycheck*\.js/, use: 'ignore-loader' },
      { test: /flycheck*\.d.ts/, use: 'ignore-loader' },
      // end of ignore-loader
      //
      { test: /\.py$/, use: 'file-loader' },
      { test: /\.ico$/, use: 'ignore-loader' },
      { test: /\.jpg$/, use: 'ignore-loader' },
      { test: /\.png$/, use: 'ignore-loader' },
      { test: /\.svg$/, use: 'ignore-loader' },
      { test: /\.sh$/, use: 'raw-loader' },
      { test: /\.html$/, use: 'raw-loader' },
      { test: /\.yaml$/, use: 'raw-loader' },
      { test: /JSONStream\/index.js$/, use: 'shebang-loader' }
    ])
  },
  plugins,
  // stats: 'verbose',
  output: {
    filename: productName.toLowerCase() + '.min.js',
    publicPath: '',
    path: outputPath,
    library: {
      name: productName.toLowerCase(),
      type: 'commonjs'
    }
  }
}
