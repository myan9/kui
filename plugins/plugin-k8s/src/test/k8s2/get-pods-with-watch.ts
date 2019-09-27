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
import { cli, selectors, AppAndCount } from '@kui-shell/core/tests/lib/ui'
import { waitForGreen, waitForRed, createNS, allocateNS, deleteNS } from '@kui-shell/plugin-k8s/tests/lib/k8s/utils'
import * as assert from 'assert'

/** name of the pod */
const podName = 'nginx'

/** source for the resource spec */
const url = 'https://raw.githubusercontent.com/kubernetes/examples/master/staging/pod'

enum Status {
  Offline = 'red-background',
  Online = 'green-background'
}

/** after a cli.do (res), wait for a table row with the given status */
const waitForStatus = async function(this: Common.ISuite, status: Status, res) {
  const selector = await cli.expectOKWithCustom({
    selector: selectors.BY_NAME(podName)
  })(res)

  if (status === Status.Offline) {
    return waitForRed(this.app, selector)
  } else {
    return waitForGreen(this.app, selector)
  }
}

/** create, then delete; the create table status had better not change */
const createAndDeletePod = function(this: Common.ISuite, kubectl: string, ns: string) {
  it(`should create then delete sample pod from URL via ${kubectl}`, async () => {
    try {
      const waitForOnline: (res: AppAndCount) => Promise<string> = waitForStatus.bind(this, Status.Online)

      const waitForOffline: (res: AppAndCount) => Promise<string> = waitForStatus.bind(this, Status.Offline)

      const selector1 = await waitForOnline(await cli.do(`${kubectl} create -f ${url} -n ${ns}`, this.app))
      const selector2 = await waitForOffline(await cli.do(`${kubectl} delete -f ${url} -n ${ns}`, this.app))

      // the first badge.Online selector had better still exist after the delete
      await this.app.client.waitForExist(selector1)

      const selector3 = await waitForOnline(await cli.do(`${kubectl} create -f ${url} -n ${ns}`, this.app))

      // that second badge.Offline selector had better still exist after the (second) create
      await this.app.client.waitForExist(selector2)

      // one last delete...
      await waitForOffline(await cli.do(`${kubectl} delete -f ${url} -n ${ns}`, this.app))

      // the previous badges had all better still exist after that second delete
      await this.app.client.waitForExist(selector1)
      await this.app.client.waitForExist(selector2)
      await this.app.client.waitForExist(selector3)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
}

/** k get pods -w */
const watchPods = function(this: Common.ISuite, kubectl: string, ns: string) {
  it(`should watch pods via ${kubectl} get pods -w`, async () => {
    try {
      const waitForOnline: (res: AppAndCount) => Promise<string> = waitForStatus.bind(this, Status.Online)
      const waitForOffline: (res: AppAndCount) => Promise<string> = waitForStatus.bind(this, Status.Offline)

      const selector1 = await waitForOnline(await cli.do(`${kubectl} create -f ${url} -n ${ns}`, this.app))
      const selector2 = await waitForOnline(await cli.do(`${kubectl} get pods -w -n ${ns}`, this.app))
      const selector2ButOffline = selector2.replace(Status.Online, Status.Offline)
      const selector3 = await waitForOffline(await cli.do(`${kubectl} delete -f ${url} -n ${ns}`, this.app))

      // the create and delete badges had better still exist
      await this.app.client.waitForExist(selector1)
      await this.app.client.waitForExist(selector3)

      // the "online" badge from the watch had better *NOT* exist after the delete
      // (i.e. we had better actually be watching!)
      await this.app.client.waitForExist(selector2, 20000, true)

      // and, conversely, that watch had better eventually show Offline
      await this.app.client.waitForExist(selector2ButOffline)

      // create again
      await waitForOnline(await cli.do(`${kubectl} create -f ${url} -n ${ns}`, this.app))

      // the "online" badge from the watch had better now exist again after the create
      // (i.e. we had better actually be watching!)
      await this.app.client.waitForExist(selector2)

      // and, conversely, that watch had better NOT show Offline
      await this.app.client.waitForExist(selector2ButOffline, 20000, true)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
}

const checkWatchableJobs = function(
  this: Common.ISuite,
  kubectl: string,
  ns: string,
  jobCount = 0,
  createResource = false
) {
  if (createResource) {
    it(`should create a watchable job via ${kubectl} get pods -w`, async () => {
      try {
        const waitForOnline: (res: AppAndCount) => Promise<string> = waitForStatus.bind(this, Status.Online)
        await waitForOnline(await cli.do(`${kubectl} get pods -w -n ${ns}`, this.app))
      } catch (err) {
        await Common.oops(this, true)(err)
      }
    })
  }

  it(`should have ${jobCount} watchable jobs in the tab`, async () => {
    try {
      const watchableJobsRaw = await this.app.client.execute(() => {
        return document.querySelector('tab.visible')['state'].jobs
      })
      const actualJobCount = watchableJobsRaw.value
      assert.strictEqual(actualJobCount, jobCount)
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })
}

const synonyms = ['k']

describe(`kubectl watch pod ${process.env.MOCHA_RUN_TARGET}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  synonyms.forEach(kubectl => {
    const ns: string = createNS()
    const createAndDeleteIt: () => void = createAndDeletePod.bind(this, kubectl, ns)
    const watchIt: () => void = watchPods.bind(this, kubectl, ns)
    const checkJob: (jobCount: number, createResource: boolean) => void = checkWatchableJobs.bind(this, kubectl, ns)

    //
    // here come the tests
    //
    allocateNS(this, ns)
    createAndDeleteIt()

    // the current tab should have jobs = [] due to watcher being collected after reaching final-state
    checkJob(0, false)

    watchIt()

    // the current tab should only contain 1 watching job for `k get pods -w`
    checkJob(1, false)

    // create a new watchable job and expect 2 jobs in the tab
    checkJob(2, true)

    // create a new watchable job and expect 3 jobs in the tab
    checkJob(3, true)

    // create a new watchable job and expect 4 jobs in the tab
    checkJob(4, true)

    // create a new watchable job and expect 5 jobs in the tab
    checkJob(5, true)

    // create a new watchable job and expect 6 jobs in the tab
    checkJob(6, true)

    // ensure that we still have only 6 watchable jobs, since that is the default maximum watchers per tab
    checkJob(6, true)
    checkJob(6, true)
    checkJob(6, true)
    checkJob(6, true)

    it('should add new tab via command', () =>
      cli
        .do('tab new', this.app)
        .then(() => this.app.client.waitForVisible(selectors.TAB_SELECTED_N(2)))
        .then(() => Common.waitForSession(this)) // should have an active repl
        .catch(Common.oops(this, true)))

    // undefined means that the new tab shouldn't have jobs even initialized
    checkJob(undefined, false)

    it(`should switch back to first tab via command`, () =>
      cli.do('tab switch 1', this.app).catch(Common.oops(this, true)))

    // the original tab should still have 6 jobs running
    checkJob(6, false)

    it('should close tab via "tab close" command', () =>
      cli
        .do('tab close', this.app)
        .then(() => this.app.client.waitForExist(selectors.TAB_N(2), 20000, true))
        .then(() => this.app.client.waitForExist(selectors.TAB_SELECTED_N(1)))
        .then(() => cli.waitForRepl(this.app)) // should have an active repl
        .catch(Common.oops(this, true)))

    // undefined means that the current tab shouldn't have jobs even initialized
    checkJob(undefined, false)

    // create a new watchable job and expect 1 jobs in the tab
    checkJob(1, true)

    it('should clear the console', () =>
      cli
        .do('clear', this.app)
        .then(() => cli.expectConsoleToBeClear(this.app))
        .catch(Common.oops(this, true)))

    // after `clear`, the current tab should have jobs = []
    checkJob(0, false)

    deleteNS(this, ns)
  })
})
