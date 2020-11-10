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

import { CLI, ReplExpect, SidecarExpect, Common, Selectors } from '@kui-shell/test'
import { waitForGreen, createNS, allocateNS, deleteNS } from '@kui-shell/plugin-kubectl/tests/lib/k8s/utils'

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-kubectl/tests/package.json'))

const crashy = [
  {
    id: 'all',
    content: 'kui-crashy',
    children: [
      {
        id: 'unlabeled',
        content: 'kui-crashy',
        children: [
          {
            id: 'unlabeled---Pod',
            content: 'kui-crashy',
            children: [
              {
                id: 'unlabeled---Pod---kui-crashy',
                content: 'kui-crashy'
              }
            ]
          }
        ]
      }
    ]
  }
]

const bunch = [
  {
    id: 'all',
    content: 'kui-crashy',
    children: [
      {
        id: 'travelapp',
        content: 'name: travelapp',
        children: [
          {
            id: 'travelapp---Deployment.v1.apps',
            content: 'kind: Deployment',
            children: [
              {
                id: 'travelapp---Deployment.v1.apps---travelapp',
                content: 'name: travelapp'
              }
            ]
          },
          {
            id: 'travelapp---HorizontalPodAutoscaler.v1.autoscaling',
            content: 'kind: HorizontalPodAutoscaler',
            children: [
              {
                id: 'travelapp---HorizontalPodAutoscaler.v1.autoscaling---travelapp-hpa',
                content: 'kind: HorizontalPodAutoscaler'
              }
            ]
          }
        ]
      },
      {
        id: 'unlabeled',
        content: 'name: eventgen',
        children: [
          {
            id: 'unlabeled---Pod',
            content: 'name: eventgen',
            children: [
              {
                id: 'unlabeled---Pod---eventgen',
                content: 'name: eventgen'
              },
              {
                id: 'unlabeled---Pod---nginx',
                content: 'name: nginx'
              }
            ]
          }
        ]
      }
    ]
  }
]

const commands = ['kubectl']
if (process.env.NEEDS_OC) {
  commands.push('oc')
}

commands.forEach(command => {
  const ns: string = createNS()
  const inNamespace = `-n ${ns}`

  describe(`1-${command} get dashF create before ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
    before(Common.before(this))
    after(Common.after(this))

    allocateNS(this, ns)

    it('should get dashF notDeployed file and hit apply', () =>
      CLI.command(`${command} get -f ${ROOT}/data/k8s/crashy.yaml ${inNamespace}`, this.app)
        .then(ReplExpect.ok)
        .then(SidecarExpect.open)
        .then(SidecarExpect.mode('sources'))
        .then(SidecarExpect.tree(crashy))
        .then(async _ => {
          const buttonSelector = Selectors.SIDECAR_TOOLBAR_BUTTON(_.count, 'apply')
          await this.app.client.waitForVisible(buttonSelector)
          await this.app.client.click(buttonSelector)
          const res = ReplExpect.blockAfter(_)
          const selector = await ReplExpect.okWithCustom({ selector: Selectors.BY_NAME('kui-crashy') })(res)
          await waitForGreen(this.app, selector)
        })
        .catch(Common.oops(this, true)))

    it('should get dashF deloyed file', () =>
      CLI.command(`${command} get -f ${ROOT}/data/k8s/crashy.yaml ${inNamespace}`, this.app)
        .then(ReplExpect.ok)
        .then(SidecarExpect.open)
        .then(SidecarExpect.mode('sources'))
        .then(SidecarExpect.tree(crashy))
        .then(async _ => {
          const modeSelector = Selectors.SIDECAR_MODE_BUTTON(_.count, 'deployed resources')
          console.error('modeSelector', modeSelector)
          await this.app.client.waitForVisible(modeSelector)
          await this.app.client.click(modeSelector)
          return _
        })
        .then(SidecarExpect.mode('deployed resources'))
        // FIXME .then(SidecarExpect.tree(crashy))
        .catch(Common.oops(this, true)))

    it('should get dashF notDeployed directory and hit apply', () =>
      CLI.command(`${command} get -f ${ROOT}/data/k8s/bunch ${inNamespace}`, this.app)
        .then(ReplExpect.ok)
        .then(SidecarExpect.open)
        .then(SidecarExpect.mode('sources'))
        .then(SidecarExpect.tree(bunch))
        .then(async _ => {
          const buttonSelector = Selectors.SIDECAR_TOOLBAR_BUTTON(_.count, 'apply')
          await this.app.client.waitForVisible(buttonSelector)
          await this.app.client.click(buttonSelector)
        })
        .catch(Common.oops(this, true)))

    deleteNS(this, ns)
  })
})
