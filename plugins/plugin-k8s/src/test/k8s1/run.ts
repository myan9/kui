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
import { cli, selectors } from '@kui-shell/core/tests/lib/ui'
import { waitForGreen, createNS, allocateNS, deleteNS } from '@kui-shell/plugin-k8s/tests/lib/k8s/utils'

const synonyms = ['kubectl', 'k']

describe('electron kubectl run', function(this: Common.ISuite) {
  before(Common.before(this))
  after(Common.after(this))

  // repeat the tests for kubectl, k, etc. i.e. any built-in
  // synonyms/aliases we have for "kubectl"
  synonyms.forEach(kubectl => {
    const ns: string = createNS()
    allocateNS(this, ns)

    it(`should create deployment from ${kubectl} run`, () => {
      return cli
        .do(`${kubectl} run nginx --image nginx -n ${ns}`, this.app)
        .then(cli.expectOKWithCustom({ selector: selectors.BY_NAME('nginx') }))
        .then(selector => waitForGreen(this.app, selector))
        .catch(Common.oops(this))
    })

    it(`should delete the deployment by name via ${kubectl}`, () => {
      return cli
        .do(`${kubectl} delete deployment nginx -n ${ns}`, this.app)
        .then(cli.expectOKWithAny)
        .catch(Common.oops(this))
    })

    deleteNS(this, ns)
  })
})
