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
const { cli, selectors, sidecar } = ui
const { localDescribe } = common

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-openwhisk/tests/package.json'))

// TODO: test this in webpack
localDescribe('Create a packaged action then invoke with implicit entity', function (this: common.ISuite) {
  before(openwhisk.before(this))
  after(common.after(this))

  // create an action, using the implicit entity type
  it('should create a packaged action', () => cli.do(`let ppp/foo = ${ROOT}/data/openwhisk/foo.js`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing('foo', undefined, undefined, 'ppp'))
    .catch(common.oops(this)))

  // invoke it asynchronously with no params
  it('should async that action', () => cli.do(`async`, this.app)
    .then(cli.expectOKWithCustom(cli.makeCustom('.activationId', '')))
    .then(selector => this.app.client.getText(selector)
      .then(activationId => this.app.client.click(selector)
        .then(() => sidecar.expectOpen(this.app))
        .then(sidecar.expectShowing('foo', activationId))))
    .catch(common.oops(this)))

  it('should get/open the package', () => cli.do(`package get ppp`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing('ppp'))
    .catch(common.oops(this)))

  // re-open the packaged action and invoke it, for good measure
  it('should create re-open the packaged action', () => cli.do(`action get ppp/foo`, this.app)
    .then(cli.expectJustOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing('foo', undefined, undefined, 'ppp'))
    .catch(common.oops(this)))

  // invoke it asynchronously with no params
  it('should async that action', () => cli.do(`async`, this.app)
    .then(cli.expectOKWithCustom(cli.makeCustom('.activationId', '')))
    .then(selector => this.app.client.getText(selector)
      .then(activationId => this.app.client.click(selector)
        .then(() => sidecar.expectOpen(this.app))
        .then(sidecar.expectShowing('foo', activationId))))
    .catch(common.oops(this)))
})
