/*
 * Copyright 2018 IBM Corporation
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

const myDebug = require('debug')('webapp/bootstrap/electron')

if (process.cwd() === '/') {
  // ugh, on macos, dock- and finder-launched apps have a cwd of /
  try {
    process.chdir(require('expand-home-dir')('~'))
  } catch (err) {
    console.error(err)
  }
}

if (process.env.TEST_ROOT || process.env.WEBPACK_TEST) {
  myDebug('lifting repl to global for tests')
  global['repl'] = require('@kui-shell/core/core/repl')
}

try {
  require('./boot').default()
} catch (err) {
  require('@kui-shell/core/webapp/bootstrap/boot').default()
}
