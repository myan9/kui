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

import { dirname, join } from 'path'

import { Common } from '@kui-shell/test'
import * as ui from '@kui-shell/core/tests/lib/ui'

const { cli, sidecar } = ui

/**
 * Notes: there seems to be a bug in node-pty right now on Linux
 * https://github.com/microsoft/node-pty/issues/85
 * so we can't use big.json
 */
const ROOT = dirname(require.resolve('@kui-shell/plugin-bash-like/package.json'))
const input = join(ROOT, 'tests/data/small.json')

describe('cat json to sidecar', function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  Common.pit('cat a json file and expect it to appear in the sidecar', () =>
    cli
      .do(`cat "${input}"`, this.app)
      .then(cli.expectJustOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing('small.json', undefined, undefined, 'openshift-operators'))
      .catch(Common.oops(this))
  )

  Common.pit('cat a json file, pipe it to jq, and expect it to appear in the sidecar', () =>
    cli
      .do(`cat "${input}" | jq`, this.app)
      .then(cli.expectJustOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing('small.json', undefined, undefined, 'openshift-operators'))
      .catch(Common.oops(this))
  )
})
