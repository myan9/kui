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

import * as assert from 'assert'

import * as common from '@kui-shell/core/tests/lib/common'
import * as ui from '@kui-shell/core/tests/lib/ui'
import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
const { cli, selectors, sidecar } = ui
const { localDescribe } = common

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-openwhisk/tests/package.json'))

const actionName = 'foo'
const actionName2 = 'foo2'
const actionName3 = 'foo3'

// TODO: test this in webpack
localDescribe('Copy actions using the wsk syntax', function (this: common.ISuite) {
  before(openwhisk.before(this))
  after(common.after(this))

  // create an action, using the implicit entity type
  it('should create an action', () => cli.do(`create ${actionName} ${ROOT}/data/openwhisk/foo.js -p x 5 -p y 10`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName)))

  it('should switch to parameters mode', () => cli.do('parameters', this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName))
    .then(app => app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .action-source`))
    .then(ui.expectStruct({ 'x': 5, 'y': 10 })))

  it('should copy an action', () => cli.do(`create --copy ${actionName2} ${actionName} -p x 8`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName2)))

  // note that we expect the value of x to be overridden, and that of y to be copied from foo
  it('should switch to parameters mode', () => cli.do('parameters', this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName2))
    .then(app => app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .action-source`))
    .then(ui.expectStruct({ 'x': 8, 'y': 10 })))

  it('should copy an action with --copy in an alternate spot', () => cli.do(`create ${actionName3} --copy  ${actionName} -p x 8 -p y 1`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName3)))

  // note that we expect the values of x and y both to be overridden
  it('should switch to parameters mode', () => cli.do('parameters', this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(actionName3))
    .then(app => app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .action-source`))
    .then(ui.expectStruct({ 'x': 8, 'y': 1 })))
})
