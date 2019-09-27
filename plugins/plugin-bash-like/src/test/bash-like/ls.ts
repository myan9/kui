/*
 * Copyright 2019 IBM Corporation
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
const { cli } = ui

const echoString = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

describe(`directory listing ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  Common.proxyIt('should cd to the test dir', () =>
    cli
      .do(`cd ${process.env.TEST_ROOT}`, this.app)
      .then(cli.expectOKWithString('packages/test'))
      .catch(Common.oops(this, true))
  )

  it('should use ls ../../', () =>
    cli
      .do(`ls ../../`, this.app)
      .then(cli.expectOKWith('package.json'))
      .catch(Common.oops(this)))

  it('should ls with semicolons 1', () =>
    cli
      .do(`ls ../../ ; echo ${echoString}`, this.app)
      .then(cli.expectOKWith('package.json'))
      .catch(Common.oops(this)))

  it('should ls with semicolons 2', () =>
    cli
      .do(`ls ../../ ; echo ${echoString}`, this.app)
      .then(cli.expectOKWithString(echoString))
      .catch(Common.oops(this)))

  it('should ls with semicolons 3', () =>
    cli
      .do(`ls ../../;; ;; ; ; ;;;;; ;echo ${echoString}`, this.app)
      .then(cli.expectOKWith('package.json'))
      .catch(Common.oops(this)))

  it('should ls with semicolons 4', () =>
    cli
      .do(`ls ../../;; ;; ; ; ;;;;; ;echo ${echoString}`, this.app)
      .then(cli.expectOKWithString(echoString))
      .catch(Common.oops(this)))

  it('should use ls ../../README.md', () =>
    cli
      .do(`ls ../../README.md`, this.app)
      .then(cli.expectOKWith('README.md'))
      .catch(Common.oops(this)))

  const Cs = ['CONTRIBUTING.md']
  Cs.forEach(expect => {
    it(`should use ls ../../C* and expect ${expect}`, () =>
      cli
        .do(`ls ../../C*`, this.app)
        .then(cli.expectOKWith(expect))
        .catch(Common.oops(this)))
  })

  const CsandP = Cs.concat(['package.json'])
  CsandP.forEach(expect => {
    it('should use ls ../../C* ../package.json', () =>
      cli
        .do(`ls ../../C* ../../package.json`, this.app)
        .then(cli.expectOKWith(expect))
        .catch(Common.oops(this)))
  })

  const CsandT = Cs.concat(['tools'])
  CsandT.forEach(expect => {
    it('should use ls -d ../../C* ../tool*', () =>
      cli
        .do(`ls -d ../../C* ../../tool*`, this.app)
        .then(cli.expectOKWith(expect))
        .catch(Common.oops(this)))
  })
})
