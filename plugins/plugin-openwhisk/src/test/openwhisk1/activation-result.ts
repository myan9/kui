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

/**
 * tests that create an action and test that it shows up in the list UI
 *    this test also covers toggling the sidecar
 */
import * as common from '@kui-shell/core/tests/lib/common'
import * as ui from '@kui-shell/core/tests/lib/ui'
import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
const { cli, selectors, sidecar } = ui
const { localDescribe } = common

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-openwhisk/tests/package.json'))

const actionName1 = `foo1-${new Date().getTime()}`

//TODO: test this in webpack
localDescribe('wsk activation result and wsk activation logs', function (this: common.ISuite) {
  before(openwhisk.before(this))
  after(common.after(this))

  // create an action
  it(`should create an action ${actionName1}`, () => cli.do(`create ${actionName1} ${ROOT}/data/openwhisk/foo.js`, this.app)
    .then(cli.expectOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName1))
    .catch(common.oops(this)))

  it(`should async that action then show its logs and result`, () => cli.do(`async ${actionName1}`, this.app)
    .then(cli.expectOKWithCustom(cli.makeCustom('.activationId', '')))
    .then(selector => this.app.client.getText(selector)
      .then(activationId => this.app.client.waitUntil(() => {
        return cli.do(`wsk activation logs ${activationId}`, this.app)
          .then(cli.expectOK)
          .then(() => sidecar.expectOpen(this.app))
          .then(sidecar.expectShowing(actionName1, activationId))
          .then(sidecar.expectMode('logs'))
          .then(() => this.app.restart())
          .then(() => cli.do(`wsk activation logs ${activationId}`, this.app))
          .then(() => sidecar.expectOpen(this.app))
          .then(sidecar.expectShowing(actionName1, activationId))
          .then(sidecar.expectMode('logs'))
          .then(() => this.app.restart())
          .then(() => cli.do(`wsk activation result ${activationId}`, this.app))
          .then(() => sidecar.expectOpen(this.app))
          .then(sidecar.expectShowing(actionName1, activationId))
          .then(sidecar.expectMode('result'))
      })))
    .catch(common.oops(this)))
})
