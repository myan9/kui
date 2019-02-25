/*
 * Copyright 2017 IBM Corporation
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

/**
 * tests that create an action and test that it shows up in the list UI
 *    this test also covers toggling the sidecar
 */

import * as common from '@kui-shell/core/tests/lib/common'
import * as ui from '@kui-shell/core/tests/lib/ui'
import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
const { cli, keys, selectors, sidecar } = ui

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-openwhisk/tests/package.json'))

describe('Create action with implicit entity type, then list it', function (this: common.ISuite) {
  before(openwhisk.before(this))
  after(common.after(this))

  // create an action, using the implicit entity type
  // create an action, using the implicit entity type
  const createFoo = process.env.WEBPACK_TEST ? `let foo = (params) => { name: "Step1 " + params.name }`
    : `create foo ${ROOT}/data/openwhisk/foo.js`

  it('should create an action', () => cli.do(createFoo, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing('foo')))

  // toggle sidebar closed
  it('should toggle the sidebar closed with escape', () => this.app.client.keys(keys.ESCAPE)
    .then(() => sidecar.expectClosed(this.app)))

  // toggle sidebar back open
  it('should toggle the sidebar back open with escape', () => this.app.client.keys(keys.ESCAPE)
    .then(() => sidecar.expectOpen(this.app))
    .then(sidecar.expectShowing('foo')))

  // list tests
  ui.aliases.list.forEach(cmd => {
    it(`should find the new action with "${cmd}"`, () => cli.do(cmd, this.app).then(cli.expectOKWithOnly('foo')))
    it(`should find the new action with "action ${cmd}"`, () => cli.do(`action ${cmd}`, this.app).then(cli.expectOKWithOnly('foo')))
  })

  // toggle sidebar closed by clicking on the Close button
  it('should toggle the sidebar closed with close button click', () => this.app.client.click(ui.selectors.SIDECAR_CLOSE_BUTTON)
    .then(() => sidecar.expectClosed(this.app)))
})
