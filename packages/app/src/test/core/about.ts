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

import * as assert from 'assert'

import { ISuite } from '@kui-shell/core/tests/lib/common'
import * as common from '@kui-shell/core/tests/lib/common' // tslint:disable-line:no-duplicate-imports
import * as ui from '@kui-shell/core/tests/lib/ui'
const { cli, selectors, sidecar } = ui
const { version: expectedVersion } = require('@kui-shell/settings/package.json')

describe('About command', function (this: ISuite) {
  before(common.before(this))
  after(common.after(this))

  if (process.env.WEBPACK_TEST) {
    it('should open the about window', () => cli.do('about', this.app)
      .then(cli.expectOKWithCustom({ expected: expectedVersion }))
      .catch(common.oops(this)))
  } else {
    it('should open the about window', () => cli.do('about', this.app)
      .then(cli.expectOK)
      .then(() => this.app.client.getWindowCount())
      .then(count => assert.strictEqual(count, 2)) // about should open a new window
      .catch(common.oops(this)))
  }
})
