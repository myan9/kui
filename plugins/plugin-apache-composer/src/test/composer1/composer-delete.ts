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

import * as common from '@kui-shell/core/tests/lib/common'
import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
import * as ui from '@kui-shell/core/tests/lib/ui'
const cli = ui.cli
const sidecar = ui.sidecar
const { localDescribe } = common

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-apache-composer/tests/package.json'))

const seqName1 = 'seq1'

//TODO: test this in webpack
localDescribe('Use the app delete command to delete an invokeable composition', function (this: common.ISuite) {
  before(openwhisk.before(this))
  after(common.after(this))

  /** expected return value */
  const expect = (key, value, extraExpect, expectIsIt) => {
    if (expectIsIt) {
      return extraExpect
    } else {
      const expect = {}
      expect[key] = value
      return Object.assign(expect, extraExpect)
    }
  }

  /** invoke a composition */
  const invoke = (name, key, value, extraExpect, expectIsIt = false) => {
    it(`should invoke the composition ${name} with ${key}=${value}`, () => cli.do(`app invoke ${name} -p ${key} ${value}`, this.app)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(name))
      .then(() => this.app.client.getText(ui.selectors.SIDECAR_ACTIVATION_RESULT))
      .then(ui.expectStruct(expect(key, value, extraExpect, expectIsIt)))
      .catch(common.oops(this)))
  }

  /* {
        const cmd = `app init --reset --url ${sharedURL}`
        it(`should ${cmd}`, () => cli.do(cmd, this.app)
            .then(cli.expectOKWithCustom({expect: 'Successfully initialized the required services. You may now create compositions.'}))
           .catch(common.oops(this)))

    } */

  // we have to make an app before we can delete it
  it('should create a composer sequence', () => cli.do(`app update ${seqName1} ${ROOT}/data/composer/composer-source/echo-sequence.js`, this.app)
    .then(cli.expectOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(seqName1))
    // .then(sidecar.expectBadge(badges.sequence))
    .catch(common.oops(this)))
  invoke(seqName1, 'x', 3, undefined, undefined)

  it(`should get ${seqName1} via app get`, () => cli.do(`app get ${seqName1}`, this.app)
    .then(cli.expectOK)
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(seqName1)) // and sidecar should be showing it, too
    // .then(sidecar.expectBadge(badges.sequence))
    .catch(common.oops(this)))

  // show up in the list prior to deletion
  it(`should list ${seqName1} via app list`, () => cli.do(`app list`, this.app)
    .then(cli.expectOKWithOnly(seqName1)) // seqName1 had better still be in the list
    .then(sidecar.expectOpen)
    .then(sidecar.expectShowing(seqName1)) // and sidecar should be showing it, too
    // .then(sidecar.expectBadge(badges.sequence))
    .catch(common.oops(this)))

  it(`should delete a composer sequence`, () => cli.do(`app delete ${seqName1}`, this.app)
    .then(cli.expectOK)
    .then(sidecar.expectClosed)
    .catch(common.oops(this)))

  // now the list should be empty
  it(`should list nothing via wsk app list`, () => cli.do(`wsk app list`, this.app)
    .then(cli.expectBlank) // expect empty result from the list (other than 'OK')
    .then(sidecar.expectClosed)
    .catch(common.oops(this)))

  it(`should fail to delete an unexisting composer sequence`, () => cli.do(`app delete ${seqName1}`, this.app)
    .then(cli.expectError(404, 'The requested resource does not exist'))
    .catch(common.oops(this)))

  // now the package binding should NOT exist
  it('should fail to get the package binding', () => cli.do(`package get openwhisk-composer.${seqName1}`, this.app)
    .then(cli.expectError(404))
    .catch(common.oops(this)))
})
