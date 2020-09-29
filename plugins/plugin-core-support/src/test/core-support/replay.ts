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

import { existsSync, unlinkSync, statSync } from 'fs'
import { Common, CLI, ReplExpect, Selectors, SidecarExpect, testAbout } from '@kui-shell/test'

import { splitViaCommand, focus } from '../core-support2/split-helpers'
import { doClear } from './clear'

const base64Input = 'hi'
const base64Output = Buffer.from(base64Input).toString('base64')

describe(`snapshot and replay ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  it(`should base64 ${base64Input}`, () =>
    CLI.command(`base64 ${base64Input}`, this.app)
      .then(ReplExpect.okWithString(base64Output))
      .catch(Common.oops(this, true)))
  testAbout(this)

  it('should snapshot', () =>
    CLI.command('snapshot /tmp/test.kui', this.app)
      .then(ReplExpect.justOK)
      .catch(Common.oops(this, true)))

  it('should refresh', () => Common.refresh(this))

  it('should replay', async () => {
    try {
      const { count } = await CLI.command('replay /tmp/test.kui --status-stripe blue', this.app)

      await this.app.client.waitForExist(Selectors.STATUS_STRIPE_TYPE('blue'), CLI.waitTimeout)

      // verify the base64 command replay
      let idx = 0
      await this.app.client.waitUntil(async () => {
        const txt = await this.app.client.getText(Selectors.OUTPUT_N(count + 1))
        if (++idx > 5) {
          console.error(`still waiting for expected=${base64Output}; actual=${txt}`)
        }
        return txt === base64Output
      }, CLI.waitTimeout)

      // verify the about replay
      await SidecarExpect.notOpen(this.app)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  it('should clear and show default status stripe', async () => {
    await CLI.command('clear', this.app).then(() => ReplExpect.consoleToBeClear(this.app))

    await this.app.client.waitForExist(Selectors.STATUS_STRIPE_TYPE('default'))
  })

  xit('should freshen the snapshot', async () => {
    try {
      unlinkSync('/tmp/test.bak.kui')
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    const { mtimeMs } = statSync('/tmp/test.kui')

    // wait a few seconds, so that the mtimeMs will change
    await new Promise(resolve => setTimeout(resolve, 2000))

    await CLI.command('replay --freshen /tmp/test.kui', this.app)

    console.log('1')
    // Snapshot backup file had better exist
    await this.app.client.waitUntil(async () => {
      console.log('1a')
      const e1 = existsSync('/tmp/test.kui')
      console.log('1b', e1)
      const e2 = existsSync('/tmp/test.bak.kui')
      console.log('1c', e2)
      return e1 && e2
    }, CLI.waitTimeout)
    console.log('2')

    // Snapshot file had better have been modified
    await this.app.client.waitUntil(async () => {
      const { mtimeMs: mtimeMs2 } = statSync('/tmp/test.kui')
      console.log('3', mtimeMs2 - mtimeMs)

      return mtimeMs2 > mtimeMs
    }, CLI.waitTimeout)
  })
})

describe(`split-snapshot-replay ${process.env.MOCHA_RUN_TARGET || ''}`, async function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  const splitTheTerminalViaCommand = splitViaCommand.bind(this)
  const clickToFocus = focus.bind(this)
  const clear = doClear.bind(this)

  const doBase64 = (splitIdx: number) => {
    clickToFocus(splitIdx)
    it(`should base64 ${base64Input}`, () =>
      CLI.commandInSplit(`base64 ${base64Input}`, this.app, splitIdx)
        .then(ReplExpect.okWithString(base64Output))
        .catch(Common.oops(this, true)))
  }

  const doSnapShot = (splitIdx: number) => {
    it('should snapshot', () =>
      CLI.commandInSplit('snapshot /tmp/test.kui', this.app, splitIdx)
        .then(ReplExpect.justOK)
        .catch(Common.oops(this, true)))
  }

  // Split the terminal, then validate that the snapshot will still
  // replay with the split, despite the intervening clear. The 2
  // argument to clear means we expect 2 residual blocks in the first
  // split: one for the active block and one for the split command
  // output
  splitTheTerminalViaCommand(2)
  it('should clear the console', () => clear(2))

  doBase64(1)
  clickToFocus(2)
  doBase64(2)

  doSnapShot(2)

  it('should refresh', () => Common.refresh(this))
  it('should replay', () => CLI.command('replay /tmp/test.kui', this.app).catch(Common.oops(this, true)))
  it('should validate replay', async () => {
    try {
      const countInSplit1 = await CLI.commandInSplit('version', this.app, 1).then(_ => _.count)
      const countInSplit2 = await CLI.commandInSplit('version', this.app, 2).then(_ => _.count)

      let idx = 0
      await this.app.client.waitUntil(async () => {
        // commands in split1: [session connect in browser],base64, split, version
        const base64InSplit1 = await this.app.client.getText(Selectors.OUTPUT_N(countInSplit1 - 1, 1))
        // commands in split2: base64,version
        const base64InSplit2 = await this.app.client.getText(Selectors.OUTPUT_N(countInSplit2 - 1, 2))

        if (++idx > 5) {
          console.error(`still waiting for expected=${base64Output}; actual=${base64InSplit1}, ${base64InSplit2}`)
        }
        return base64InSplit1 === base64Output && base64InSplit2 === base64Output
      }, CLI.waitTimeout)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
})
