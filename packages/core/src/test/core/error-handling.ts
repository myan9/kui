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

import { Common } from '@kui-shell/test'

import * as ui from '@kui-shell/core/tests/lib/ui'
const { cli } = ui

describe('Error handling', function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  it('bind with no args', () =>
    cli
      .do('bind', this.app)
      .then(cli.expectError(497))
      .catch(Common.oops(this)))
})
