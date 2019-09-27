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
const { cli } = ui

describe(`echo command ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  Common.pit('should echo nothing variant 1', () =>
    cli
      .do('echo', this.app)
      .then(cli.expectJustOK)
      .catch(Common.oops(this))
  )

  Common.pit('should echo nothing variant 2', () =>
    cli
      .do('echo ', this.app)
      .then(cli.expectJustOK)
      .catch(Common.oops(this))
  )

  Common.pit('should echo nothing variant 3', () =>
    cli
      .do('echo                  ', this.app)
      .then(cli.expectJustOK)
      .catch(Common.oops(this))
  )

  Common.pit('should echo hi', () =>
    cli
      .do('echo hi', this.app)
      .then(cli.expectOKWithString('hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo hi with surrounding whitespace', () =>
    cli
      .do('echo   hi               ', this.app)
      .then(cli.expectOKWithString('hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo hi hi with surrounding whitespace', () =>
    cli
      .do('echo   hi hi               ', this.app)
      .then(cli.expectOKWithString('hi hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo hi hi with intra-whitespaces', () =>
    cli
      .do('echo   hi  hi               ', this.app)
      .then(cli.expectOKWithString('hi hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo "hi  hi"', () =>
    cli
      .do('echo "hi  hi"', this.app)
      .then(cli.expectOKWithString('hi  hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo "hi  hi" with surrounding whitespace', () =>
    cli
      .do('echo   "hi  hi"               ', this.app)
      .then(cli.expectOKWithString('hi  hi'))
      .catch(Common.oops(this))
  )

  Common.pit('should echo multi', () =>
    cli
      .do('echo   "hi  hi" hi        "hi   hi"               ', this.app)
      .then(cli.expectOKWithString('hi  hi hi hi   hi'))
      .catch(Common.oops(this))
  )
})
