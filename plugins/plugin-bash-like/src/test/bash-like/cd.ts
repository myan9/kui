/*
 * Copyright 2017-19 IBM Corporation
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

import { v4 as uuid } from 'uuid'
import { dirname, join, normalize } from 'path'

import { Common } from '@kui-shell/test'
import { Util } from '@kui-shell/core/'
import * as ui from '@kui-shell/core/tests/lib/ui'

const { cli, selectors } = ui
const ROOT = dirname(require.resolve('@kui-shell/core/tests/package.json'))
const rootRelative = (dir: string) => join(ROOT, dir)

const runTheTests = process.env.MOCHA_RUN_TARGET !== 'webpack' || process.env.KUI_USE_PROXY === 'true'
const pit = runTheTests ? it : xit

describe(`bash-like cd ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  let initialDirectory: string
  pit('should echo current directory', () =>
    cli
      .do('pwd', this.app)
      .then(cli.expectOKWithAny)
      .then(async () => {
        initialDirectory = await this.app.client.getText(selectors.OUTPUT_LAST)
      })
      .catch(Common.oops(this, true))
  )

  const previous = () => {
    it(`should execute 'cd -' to change to previous dir ${initialDirectory}`, () =>
      cli
        .do(`cd -`, this.app)
        .then(cli.expectOKWithString(normalize(initialDirectory)))
        .catch(Common.oops(this, true)))
  }

  const bar = `bar${uuid()}`
  pit('should mkdir with spaces', () =>
    cli
      .do(`mkdir /tmp/"kui ${bar}"`, this.app)
      .then(cli.expectJustOK)
      .catch(Common.oops(this, true))
  )

  pit(`should execute 'cd /tmp/"kui ${bar}"'`, () =>
    cli
      .do(`cd /tmp/"kui ${bar}"`, this.app)
      .then(cli.expectOKWithString('kui bar'))
      .catch(Common.oops(this, true))
  )

  previous()

  pit(`should execute 'cd "/tmp/kui ${bar}"'`, () =>
    cli
      .do(`cd "/tmp/kui ${bar}"`, this.app)
      .then(cli.expectOKWithString('kui bar'))
      .catch(Common.oops(this, true))
  )

  previous()

  pit(`should execute 'cd /tmp/kui ${bar}'`, () =>
    cli
      .do(`cd /tmp/kui\\ ${bar}`, this.app)
      .then(cli.expectOKWithString('kui bar'))
      .catch(Common.oops(this, true))
  )

  // ls with space and trailing slash; see https://github.com/IBM/kui/issues/1389
  pit(`should execute 'ls /tmp/kui ${bar}/'`, () =>
    cli
      .do(`ls /tmp/kui\\ ${bar}/`, this.app)
      .then(cli.expectOKWithAny)
      .catch(Common.oops(this, true))
  )
  pit(`should execute 'ls /tmp/"kui ${bar}"/'`, () =>
    cli
      .do(`ls /tmp/"kui ${bar}"/`, this.app)
      .then(cli.expectOKWithAny)
      .catch(Common.oops(this, true))
  )

  previous()

  pit(`should execute 'cd data'`, () =>
    cli
      .do(`cd ${ROOT}/data`, this.app)
      .then(cli.expectOKWithString(rootRelative('data')))
      .catch(Common.oops(this, true))
  )

  previous()

  pit(`should execute 'cd -' again to change to previous-previous dir`, () =>
    cli
      .do(`cd -`, this.app)
      .then(cli.expectOKWithString(rootRelative('data')))
      .catch(Common.oops(this, true))
  )

  previous()

  // now we should be able to change back to data
  pit(`should execute 'cd data'`, () =>
    cli
      .do(`cd ${ROOT}/data`, this.app)
      .then(cli.expectOKWithString(rootRelative('data')))
      .catch(Common.oops(this, true))
  )

  pit(`should handle cd error`, () =>
    cli
      .do(`cd notexist`, this.app)
      .then(cli.expectError(500, 'cd: no such file or directory: notexist'))
      .catch(Common.oops(this, true))
  )

  pit(`should handle cd error`, () =>
    cli
      .do(`cd ../notexist`, this.app)
      .then(cli.expectError(500, 'cd: no such file or directory: ../notexist'))
      .catch(Common.oops(this, true))
  )

  pit(`should handle cd error`, () =>
    cli
      .do(`cd -/..`, this.app)
      .then(cli.expectError(499, 'Unsupported optional parameter /'))
      .catch(Common.oops(this, true))
  )

  pit(`should execute cd without arguments`, () =>
    cli
      .do('cd', this.app)
      .then(cli.expectOKWithString(Util.expandHomeDir('~')))
      .catch(Common.oops(this, true))
  )

  pit(`should execute cd ${ROOT}`, () =>
    cli
      .do(`cd ${ROOT}`, this.app)
      .then(cli.expectOKWithString(ROOT))
      .catch(Common.oops(this, true))
  )
})
