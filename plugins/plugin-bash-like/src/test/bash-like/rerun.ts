/*
 * Copyright 2020 IBM Corporation
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

import { Common, CLI, Selectors, ReplExpect, Keys } from '@kui-shell/test'

import { dirname, join } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-kubectl/tests/package.json'))

const runTheTests = process.env.MOCHA_RUN_TARGET !== 'webpack' || process.env.KUI_USE_PROXY === 'true'
const pit = runTheTests ? it : xit

// the sidecar mode presented by the open command
const openMode = 'view'

describe(`rerun command ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  it('should rerun a command that opens the sidecar', async () => {
    try {
      // open the sidecar using `open`
      const res = await CLI.command(`open ${join(ROOT, 'package.json')}`, this.app)
      await this.app.client.waitForVisible(Selectors.SIDECAR(res.count))
      await this.app.client.waitForVisible(Selectors.SIDECAR_MODE_BUTTON_SELECTED(res.count, openMode))

      // close sidecar
      // await this.app.client.waitForVisible(Selectors.SIDECAR_FULLY_CLOSE_BUTTON)
      // await this.app.client.click(Selectors.SIDECAR_FULLY_CLOSE_BUTTON)
      // await SidecarExpect.fullyClosed(this.app)

      // rerun about
      await this.app.client.moveToObject(Selectors.PROMPT_N(res.count))
      await this.app.client.waitForVisible(Selectors.COMMAND_RERUN_BUTTON(res.count))
      await this.app.client.click(Selectors.COMMAND_RERUN_BUTTON(res.count))

      // sidecar should open
      await this.app.client.waitForVisible(Selectors.SIDECAR(res.count))
      await this.app.client.waitForVisible(Selectors.SIDECAR_MODE_BUTTON_SELECTED(res.count, openMode))
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  pit('should rerun pwd', async () => {
    try {
      const pwdRes = await CLI.command('pwd', this.app)
      await ReplExpect.okWithAny(pwdRes)
      const initialDirectory = await this.app.client.getText(Selectors.OUTPUT_LAST_PTY)

      await CLI.command('cd /tmp', this.app).then(ReplExpect.okWithAny)
      const cdDirectory = await this.app.client.getText(Selectors.OUTPUT_LAST)

      await this.app.client.moveToObject(Selectors.PROMPT_N(pwdRes.count))
      await this.app.client.waitForVisible(Selectors.COMMAND_RERUN_BUTTON(pwdRes.count))
      await this.app.client.click(Selectors.COMMAND_RERUN_BUTTON(pwdRes.count))

      let idx = 0
      await this.app.client.waitUntil(async () => {
        const rerunDirectory = await this.app.client.getText(Selectors.OUTPUT_N_PTY(pwdRes.count))
        if (++idx > 5) {
          console.error(`still waiting for expected=${cdDirectory}; actual=${rerunDirectory}`)
        }
        return rerunDirectory !== initialDirectory && rerunDirectory === cdDirectory
      }, CLI.waitTimeout)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
})

describe(`rerun command by clicking the input ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  it('should rerun about by clicking the input', async () => {
    try {
      // do about
      // open the sidecar using `open`
      const res = await CLI.command(`open ${join(ROOT, 'package.json')}`, this.app)
      await this.app.client.waitForVisible(Selectors.SIDECAR(res.count))
      await this.app.client.waitForVisible(Selectors.SIDECAR_MODE_BUTTON_SELECTED(res.count, openMode))

      // close sidecar
      // await this.app.client.waitForVisible(Selectors.SIDECAR_FULLY_CLOSE_BUTTON(res.count))
      // await this.app.client.click(Selectors.SIDECAR_FULLY_CLOSE_BUTTON(res.count))
      // await SidecarExpect.fullyClosed(this.app)

      // rerun about
      await this.app.client.click(Selectors.PROMPT_N(res.count))
      await this.app.client.keys(Keys.ENTER)

      // sidecar should open
      await this.app.client.waitForVisible(Selectors.SIDECAR(res.count))
      await this.app.client.waitForVisible(Selectors.SIDECAR_MODE_BUTTON_SELECTED(res.count, openMode))
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  pit('should echo 1,11,111 by rerunning the command', async () => {
    try {
      const res = await CLI.command('echo 1', this.app)
      await ReplExpect.okWithPtyOutput('1')(res)

      await this.app.client.click(Selectors.PROMPT_N(res.count))
      await this.app.client.keys('1')
      await this.app.client.keys(Keys.ENTER)

      let idx = 0
      await this.app.client.waitUntil(async () => {
        const expectedText = '11'
        const actualText = await this.app.client.getText(Selectors.OUTPUT_N_PTY(res.count))
        if (++idx > 5) {
          console.error(`still waiting for expected=${expectedText}; actual=${actualText}`)
        }
        return actualText === expectedText
      }, CLI.waitTimeout)

      // test focus by adding another command without return
      await CLI.command('echo', this.app, true)

      await this.app.client.click(Selectors.PROMPT_N(res.count))
      await this.app.client.keys('1')
      await this.app.client.keys(Keys.ENTER)

      let jdx = 0
      await this.app.client.waitUntil(async () => {
        const expectedText = '111'
        const actualText = await this.app.client.getText(Selectors.OUTPUT_N_PTY(res.count))
        if (++jdx > 5) {
          console.error(`still waiting for expected=${expectedText}; actual=${actualText}`)
        }
        return actualText === expectedText
      }, CLI.waitTimeout)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
})
