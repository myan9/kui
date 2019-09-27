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
const { cli, keys, selectors } = ui

Common.localDescribe('input queueing', function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  const queueUp = (textWhileQueued: string, N: number, sleepTime = 2) => {
    return {
      thenType: (textAfterQueued: string, verify = cli.expectOKWithCustom({ expect: Common.expectedVersion })) => {
        xit(`should queue ${textWhileQueued} while we sleep, then ${textAfterQueued}`, async () => {
          try {
            // do something that takes a while
            const outstanding = cli.do(`sleep ${sleepTime}`, this.app)

            // first, wait until the sleep 5 has started
            await this.app.client.waitForExist(selectors.PROCESSING_N(N))

            // meanwhile, send keyboard input while queued
            this.app.client.keys(textWhileQueued)

            // now await completion of the first command; sleep should
            // result in blank output, i.e. no "ok"
            await outstanding.then(cli.expectBlankWithOpts({ nonBlankPromptOk: true }))

            if (textAfterQueued !== undefined) {
              // finally, type the trailing text and verify the output (use
              // an await, for the enclosing try/catch)
              return await cli.do(textAfterQueued, this.app).then(verify)
            } else {
              // otherwise, the ENTER was typed while queued
              return await Promise.resolve({
                app: this.app,
                count: N + 1
              }).then(verify)
            }
          } catch (err) {
            return Common.oops(this, true)(err)
          }
        })
      }
    }
  }

  // type "version" while queued, then "\n" after queued
  let nPromptBlocksSoFar = 0
  queueUp('version', nPromptBlocksSoFar).thenType('') // '' because cli.do will add a newline for us
  nPromptBlocksSoFar += 2

  // type "version\n" while queued, then "" after queued
  queueUp(`version${keys.ENTER}`, nPromptBlocksSoFar).thenType(undefined)
  nPromptBlocksSoFar += 2

  // double newlines while queued up
  queueUp(`version${keys.ENTER}${keys.ENTER}`, nPromptBlocksSoFar).thenType(undefined)
  nPromptBlocksSoFar += 3

  // triple newlines while queued up
  queueUp(`version${keys.ENTER}${keys.ENTER}${keys.ENTER}`, nPromptBlocksSoFar).thenType(undefined)
  nPromptBlocksSoFar += 4
})
