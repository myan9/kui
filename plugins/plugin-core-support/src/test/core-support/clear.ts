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

import * as assert from 'assert'

import { Common } from '@kui-shell/test'
import * as ui from '@kui-shell/core/tests/lib/ui'
const { cli, selectors, keys } = ui

describe(`clear the console ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  interface PromptOptions {
    enteredString?: string
    enteredPlaceholder?: string
    expectedPlaceholder?: string
    cancel?: boolean
  }
  const doPrompt = (opts: PromptOptions) => async () => {
    const { enteredString, enteredPlaceholder = '', expectedPlaceholder = 'Test prompt', cancel = false } = opts

    try {
      const res = await cli.do(`prompt ${enteredPlaceholder}`, this.app)
      await this.app.client.waitUntil(async () => {
        const placeholder = await this.app.client.getAttribute(selectors.PROMPT_N(res.count), 'placeholder')
        return placeholder === expectedPlaceholder
      })
      if (cancel) {
        await this.app.client.keys(ui.ctrlC)
        return cli.expectBlank(res)
      } else {
        this.app.client.keys(`${enteredString}${keys.ENTER}`)
        return cli.expectOKWithString(enteredString)(res)
      }
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  }
  const enteredString = 'does this work?'
  const enteredString2 = 'does this also work?'
  it(`quick test of prompt`, doPrompt({ enteredString }))
  it(
    `another quick test of prompt`,
    doPrompt({
      enteredString: enteredString2,
      enteredPlaceholder: 'foo',
      expectedPlaceholder: 'foo'
    })
  )
  it(
    `cancel test of prompt`,
    doPrompt({
      enteredPlaceholder: 'foo3',
      expectedPlaceholder: 'foo3',
      cancel: true
    })
  )

  // get something on the screen
  it(`should sleep`, () => cli.do('sleep 1', this.app).catch(Common.oops(this, true)))

  it('should clear the console', () =>
    cli
      .do('clear', this.app)
      .then(() => cli.expectConsoleToBeClear(this.app))
      .catch(Common.oops(this, true)))

  // get something on the screen
  it(`should sleep again`, () => cli.do('sleep 1', this.app).catch(Common.oops(this, true)))

  const JUNK = 'junk text that should stay'
  it('should clear the console with ctrl+l', () =>
    cli
      .do(JUNK, this.app, true)
      .then(async () => {
        await this.app.client.keys([ui.keys.CONTROL, 'l', 'NULL']) // use control-l to clear
        return cli.expectConsoleToBeClear(this.app)
      })
      .then(() => this.app.client.getValue(selectors.CURRENT_PROMPT))
      .then(text => assert.strictEqual(text, JUNK))
      .catch(Common.oops(this, true)))

  // hit enter, and expect that JUNK to fail
  it(`should fail with command not found`, () => {
    return cli
      .do('nope', this.app)
      .then(cli.expectError(404))
      .catch(Common.oops(this, true))
  })

  // get something on the screen
  it(`should sleep yet again`, () => cli.do('sleep 1', this.app).catch(Common.oops(this, true)))

  // FIXME prompt does not work in webpack+proxy
  it('should clear properly despite existing prompt', () =>
    cli
      .do('prompt', this.app) // wipe will change the placeholder text
      .then(async () => {
        await this.app.client.keys([ui.keys.CONTROL, 'l', 'NULL']) // use control-l to clear
        return cli.expectConsoleToBeClear(this.app)
      })
      .catch(Common.oops(this, true)))
})
