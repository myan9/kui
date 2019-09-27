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
import { cli, selectors, sidecar } from '@kui-shell/core/tests/lib/ui'
import {
  waitForGreen,
  defaultModeForGet,
  createNS,
  allocateNS,
  deleteNS,
  singletonTablesHaveTitle,
  waitTillNone
} from '@kui-shell/plugin-k8s/tests/lib/k8s/utils'

import * as assert from 'assert'
import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-k8s/tests/package.json'))

const ns: string = createNS()
const inNamespace = `-n ${ns}`

describe(`kubectl deployment ${process.env.MOCHA_RUN_TARGET || ''}`, function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  const createIt = () => {
    it('should create deployment from local file', async () => {
      try {
        const selector = await cli
          .do(`kubectl create -f ${ROOT}/data/k8s/deployment.yaml ${inNamespace}`, this.app)
          .then(cli.expectOKWithCustom({ selector: selectors.BY_NAME('myapp') }))

        const selectorPrefix = selector.replace(selectors.BY_NAME('myapp'), '')

        await this.app.client
          .getText(`${selectorPrefix} .result-table-title`)
          .then(titles => assert.ok(titles.length === 2 && titles[0] === 'DEPLOYMENT' && titles[1] === 'PODS'))

        await waitForGreen(this.app, selector)

        await this.app.client.click(`${selector} [data-value="myapp"].clickable`)

        await sidecar
          .expectOpen(this.app)
          .then(sidecar.expectMode(defaultModeForGet))
          .then(sidecar.expectShowing('myapp', undefined, undefined, ns))
      } catch (err) {
        return Common.oops(this)(err)
      }
    })
  }

  const listIt = () => {
    it('should list deployments', async () => {
      try {
        const selector = await cli
          .do(`kubectl get deployment ${inNamespace}`, this.app)
          .then(cli.expectOKWithCustom({ selector: selectors.BY_NAME('myapp') }))

        await this.app.client.click(`${selector} [data-value="myapp"].clickable`)

        const selectorPrefix = selector.replace(selectors.BY_NAME('myapp'), '')

        if (singletonTablesHaveTitle) {
          await this.app.client
            .getText(`${selectorPrefix} .result-table-title`)
            .then((title: string) => assert.ok(title === 'DEPLOYMENT'))
        }

        await sidecar
          .expectOpen(this.app)
          .then(sidecar.expectMode(defaultModeForGet))
          .then(sidecar.expectShowing('myapp', undefined, undefined, ns))
          .then(() => this.app.client.waitForVisible(selectors.SIDECAR_MODE_BUTTON('pods')))
          .then(() => this.app.client.click(selectors.SIDECAR_MODE_BUTTON('pods')))
          .then(() => this.app.client.waitForExist(`${selectors.SIDECAR_CUSTOM_CONTENT} .bx--data-table`))
          .then(async () => {
            if (singletonTablesHaveTitle) {
              const actualTitle = await this.app.client.getText(
                `${selectors.SIDECAR_CUSTOM_CONTENT} .result-table-title`
              )
              assert.strictEqual(actualTitle, 'PODS')
            }
          })
      } catch (err) {
        return Common.oops(this)(err)
      }
    })
  }

  const deleteItByName = () => {
    it('should delete the deployment by name', () => {
      return cli
        .do(`kubectl delete deployment myapp ${inNamespace}`, this.app)
        .then(cli.expectOKWithAny)
        .then(() => waitTillNone('deployment', undefined, 'myapp', undefined, inNamespace))
        .catch(Common.oops(this))
    })
  }

  const deleteItByClickingOnButton = () => {
    it('should delete the deployment by clicking on the sidecar delete button', async () => {
      try {
        await this.app.client.click(selectors.SIDECAR_MODE_BUTTON('delete'))
        await this.app.client.waitForExist('#confirm-dialog')
        await this.app.client.click('#confirm-dialog .bx--btn--danger')
        await waitTillNone('deployment', undefined, 'myapp', undefined, inNamespace)
      } catch (err) {
        return Common.oops(this)(err)
      }
    })
  }

  //
  // here start the tests
  //
  allocateNS(this, ns)

  createIt()
  listIt()
  deleteItByName()

  createIt()
  deleteItByClickingOnButton()

  deleteNS(this, ns)
})
