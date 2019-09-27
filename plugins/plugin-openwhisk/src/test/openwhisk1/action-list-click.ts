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

import { Common } from '@kui-shell/test'
import * as ui from '@kui-shell/core/tests/lib/ui'
import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
const { cli, sidecar } = ui

const actionName = 'foo'
const actionName2 = 'foo2'

describe('create action list it then click to show it again', function(this: Common.ISuite) {
  before(openwhisk.before(this))
  after(Common.after(this))

  it('should create an action', () =>
    cli
      .do(`let ${actionName} = x=>x -p x 3`, this.app)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(actionName))
      .catch(Common.oops(this)))

  it('should create another action', () =>
    cli
      .do(`let ${actionName2} = x=>x -p x 3`, this.app)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(actionName2))
      .catch(Common.oops(this)))

  const expectedSrc = 'let main = x => x'

  it(`should list ${actionName}, click it, show it`, () =>
    cli
      .do(`wsk action list`, this.app)
      .then(cli.expectOKWithCustom({ selector: '', passthrough: true }))

      // click on the row entity, and expect sidecar to show it
      .then(N =>
        this.app.client.click(`${ui.selectors.OUTPUT_N(N)} .entity[data-name="${actionName}"] .entity-name.clickable`)
      )
      .then(() => this.app)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(actionName))

      // also confirm that source matches
      .then(() =>
        this.app.client.waitUntil(async () => {
          const actualSrc = await this.app.client.getText(ui.selectors.SIDECAR_ACTION_SOURCE)
          return actualSrc.trim() === expectedSrc
        })
      )

      // wait a bit and retry, to make sure it doesn't disappear
      .then(() => new Promise(resolve => setTimeout(resolve, 3000)))
      .then(() =>
        this.app.client.waitUntil(async () => {
          const actualSrc = await this.app.client.getText(ui.selectors.SIDECAR_ACTION_SOURCE)
          return actualSrc.trim() === expectedSrc
        })
      )

      .catch(Common.oops(this)))
})
