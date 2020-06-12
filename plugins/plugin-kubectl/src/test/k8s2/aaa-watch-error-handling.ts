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

import { Common, CLI, ReplExpect, Selectors, SidecarExpect } from '@kui-shell/test'
import { createNS, waitForGreen, waitForRed, defaultModeForGet } from '@kui-shell/plugin-kubectl/tests/lib/k8s/utils'

const wdescribe = process.env.USE_WATCH_PANE ? describe : xdescribe

wdescribe(`kubectl watch error handler via watch pane ${process.env.MOCHA_RUN_TARGET || ''}`, function(
  this: Common.ISuite
) {
  before(Common.before(this))
  after(Common.after(this))

  const testResourceNotFound = (watchCmd: string, resourceType: string, resourceName: string) => {
    const errorMessage = `Error from server (NotFound): ${resourceType} "${resourceName}" not found`

    it(`should error out when watching a non-existent ${resourceType}`, () => {
      return CLI.command(watchCmd, this.app)
        .then(ReplExpect.error(404, errorMessage))
        .catch(Common.oops(this, true))
    })
  }

  const testWrongCommand = (watchCmd: string, code: number, errMessage?: string) => {
    it(`should error out with wrong command ${watchCmd}`, () => {
      return CLI.command(watchCmd, this.app)
        .then(errMessage ? ReplExpect.error(code, errMessage) : ReplExpect.error(code))
        .catch(Common.oops(this, true))
    })
  }

  // here comes the tests that expect failure due to non-existent resources
  const flags = ['-w', '--watch=true', '-w -w -w']
  flags.forEach(watch => {
    testResourceNotFound(`k get ns shouldNotExist ${watch}`, 'namespaces', 'shouldNotExist')
    testResourceNotFound(`k get ns ${watch} shouldNotExist`, 'namespaces', 'shouldNotExist')

    testResourceNotFound(`k get pod shouldNotExist ${watch}`, 'pods', 'shouldNotExist')
    testResourceNotFound(`k get ${watch} pod shouldNotExist`, 'pods', 'shouldNotExist')

    testResourceNotFound(`k get pods shouldNotExist -n shouldNotExist ${watch}`, 'namespaces', 'shouldNotExist')
  })

  // here comes the tests that expect failure due to wrong flag
  const wrongFlags = ['--watch true', '-w true']
  wrongFlags.forEach(watch => {
    testResourceNotFound(`k get pod ${watch}`, 'pods', 'true') // the command is parsed as `kubectl get pod true`
    testWrongCommand(`k get ${watch} pod`, 404, 'error: the server doesn\'t have a resource type "true"') // the command is parsed as `kubectl get true pod`
  })

  testWrongCommand(`k -w get pod`, 500)

  // test wrong resource type
  testWrongCommand(`k get shouldNotExist -w`, 404, 'error: the server doesn\'t have a resource type "shouldNotExist"')
  testWrongCommand(
    `k get shouldNotExist --watch -n shouldNotExist`,
    404,
    'error: the server doesn\'t have a resource type "shouldNotExist"'
  )

  // here comes the tests should start watching successfully
  const ns = createNS()

  it(`should watch pods, starting from an non-existent namespace`, async () => {
    try {
      console.error('watch from non-existent namespace 0')
      // start to watch pods in a non-existent namespace
      await CLI.command(`k get pods -w -n ${ns}`, this.app)

      console.error('watch from non-existent namespace 1')
      // create the namespace
      await CLI.command(`k create ns ${ns}`, this.app)
        .then(ReplExpect.okWithCustom({ selector: Selectors.BY_NAME(ns) }))
        .then(status => waitForGreen(this.app, status))

      console.error('watch from non-existent namespace 2')
      // create a pod
      await CLI.command(
        `k create -f https://raw.githubusercontent.com/kubernetes/examples/master/staging/pod -n ${ns}`,
        this.app
      )
        .then(ReplExpect.okWithCustom({ selector: Selectors.BY_NAME('nginx') }))
        .then(status => waitForGreen(this.app, status))

      console.error('watch from non-existent namespace 3')

      // the watch table should have the new pods with online status
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))

      console.error('watch from non-existent namespace 3.5')
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_ONLINE_FOR_SPLIT(2, 'nginx'))

      console.error('watch from non-existent namespace 4')
      // delete the pod
      await CLI.command(`k delete pods nginx -n ${ns}`, this.app)
        .then(ReplExpect.okWithCustom({ selector: Selectors.BY_NAME('nginx') }))
        .then(status => waitForRed(this.app, status))

      console.error('watch from non-existent namespace 5')
      // the watch table should have the new pods with offline status
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_OFFLINE_FOR_SPLIT(2, 'nginx'), CLI.waitTimeout)

      console.error('watch from non-existent namespace 6')
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  it('should reload', () => Common.refresh(this))

  it('should watch pods and hit the maximum limit of pinned views', async () => {
    try {
      // create a pod
      await CLI.command(
        `k create -f https://raw.githubusercontent.com/kubernetes/examples/master/staging/pod -n ${ns}`,
        this.app
      )
        .then(ReplExpect.okWithCustom({ selector: Selectors.BY_NAME('nginx') }))
        .then(status => waitForGreen(this.app, status))

      await CLI.command(`k get pods -w -n ${ns}`, this.app).then(
        ReplExpect.okWithString('Output has been pinned to a watch pane')
      )

      await CLI.command(`k get pods -w -n ${ns}`, this.app).then(
        ReplExpect.okWithString('Output has been pinned to a watch pane')
      )

      await CLI.command(`k get pods -w -n ${ns}`, this.app).then(
        ReplExpect.okWithString('Output has been pinned to a watch pane')
      )

      await CLI.command(`k get pods -w -n ${ns}`, this.app).then(
        ReplExpect.error(
          500,
          'You have reached the maximum number of pinned views. Consider either closing one, or re-executing the command in a new tab.'
        )
      )
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  it('should reload', () => Common.refresh(this))

  it('should watch pods and exit the terminal', async () => {
    try {
      await CLI.command(`k get pods -w -n ${ns}`, this.app)
        .then(ReplExpect.okWithString('Output has been pinned to a watch pane'))
        .then(() => ReplExpect.splitCount(4)(this.app))

      await this.app.client.waitForExist(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))

      // exit the first terminal and still see two splits
      await CLI.command('exit', this.app).then(() => ReplExpect.splitCount(4)(this.app))

      // watch pane should not be affected
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  it('should open sidecar via watch pane, and click the sidecar title to pexec in terminal', async () => {
    try {
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))
      await this.app.client.click(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))

      await SidecarExpect.open(this.app)
        .then(SidecarExpect.mode(defaultModeForGet))
        .then(SidecarExpect.showing('nginx'))

      await this.app.client.click(Selectors.SIDECAR_TITLE)

      // this is the first command in the terminal, since we exit this terminal in the previosu test
      await ReplExpect.okWithCustom({ selector: Selectors.BY_NAME('nginx') })({ app: this.app, count: 0 })

      // split pane should not be affected
      await ReplExpect.splitCount(4)(this.app)

      // watch pane should not be affected
      await this.app.client.waitForExist(Selectors.CURRENT_GRID_BY_NAME_FOR_SPLIT(2, 'nginx'))
    } catch (err) {
      await Common.oops(this, true)(err)
    }
  })

  it('should delete the namespace', () =>
    CLI.command(`k delete ns ${ns}`, this.app)
      .then(ReplExpect.okWithCustom({ selector: Selectors.BY_NAME(ns) }))
      .then(nsStatus => waitForRed(this.app, nsStatus))
      .catch(Common.oops(this, true)))
})
