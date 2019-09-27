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

describe('wsk action invoke -r', function(this: Common.ISuite) {
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

  it(`should invoke ${actionName} with -r`, () =>
    cli
      .do(`wsk action invoke ${actionName} -r`, this.app)
      .then(cli.expectOKWithCustom({ selector: '.json' }))
      .then(selector => this.app.client.getText(selector))
      .then(ui.expectStruct({ x: 3 }))
      .catch(Common.oops(this)))

  it(`should invoke ${actionName} with --result`, () =>
    cli
      .do(`wsk action invoke ${actionName} --result`, this.app)
      .then(cli.expectOKWithCustom({ selector: '.json' }))
      .then(selector => this.app.client.getText(selector))
      .then(ui.expectStruct({ x: 3 }))
      .catch(Common.oops(this)))

  it(`should invoke ${actionName} with -br`, () =>
    cli
      .do(`wsk action invoke ${actionName} -br`, this.app)
      .then(cli.expectOKWithCustom({ selector: '.json' }))
      .then(selector => this.app.client.getText(selector))
      .then(ui.expectStruct({ x: 3 }))
      .catch(Common.oops(this)))

  it(`should invoke ${actionName} with -rb`, () =>
    cli
      .do(`wsk action invoke ${actionName} -rb`, this.app)
      .then(cli.expectOKWithCustom({ selector: '.json' }))
      .then(selector => this.app.client.getText(selector))
      .then(ui.expectStruct({ x: 3 }))
      .catch(Common.oops(this)))

  it(`should invoke ${actionName} with --blocking --result`, () =>
    cli
      .do(`wsk action invoke ${actionName} --blocking --result`, this.app)
      .then(cli.expectOKWithCustom({ selector: '.json' }))
      .then(selector => this.app.client.getText(selector))
      .then(ui.expectStruct({ x: 3 }))
      .catch(Common.oops(this)))
})
