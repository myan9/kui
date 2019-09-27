/*
 * Copyright 2018-19 IBM Corporation
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
import { kubectl, cli as kui, CLI } from '@kui-shell/core/tests/lib/headless'
import { createNS, waitTillNone } from '@kui-shell/plugin-k8s/tests/lib/k8s/utils'

import { dirname } from 'path'
const ROOT = dirname(require.resolve('@kui-shell/plugin-k8s/tests/package.json'))

const synonyms = ['kubectl', 'k']

const doHeadless = (ctx: Common.ISuite, impl: CLI) => {
  before(Common.before(ctx, { noApp: true }))

  synonyms.forEach(kubectl => {
    const ns: string = createNS()
    const inNamespace = `-n ${ns}`

    it(`should create namespace ${ns} via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} create namespace ${ns}`, ctx.app)
        .then(impl.expectOK(ns))
        .catch(Common.oops(ctx, true))
    })

    it(`should create sample pod from local file via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} create -f ${ROOT}/data/k8s/headless/pod.yaml ${inNamespace}`, ctx.app)
        .then(impl.expectOK('nginx'))
        .catch(Common.oops(ctx, true))
    })

    it(`should list the new pod via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} get pods ${inNamespace}`, ctx.app)
        .then(impl.expectOK('nginx'))
        .catch(Common.oops(ctx, true))
    })

    it(`should get the new pod via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} get pod nginx ${inNamespace}`, ctx.app)
        .then(impl.expectOK('nginx'))
        .catch(Common.oops(ctx, true))
    })

    it(`should get the new pod as JSON via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} get pod nginx -o json ${inNamespace}`, ctx.app)
        .then(
          impl.expectOK({
            kind: 'Pod',
            metadata: {
              name: 'nginx'
            }
          })
        )
        .catch(Common.oops(ctx, true))
    })

    it(`should delete the new pod by yaml via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} delete -f ${ROOT}/data/k8s/headless/pod.yaml ${inNamespace}`, ctx.app)
        .then(impl.expectOK('pod "nginx" deleted'))
        .then(() => waitTillNone('pods', impl, 'nginx', undefined, inNamespace)(ctx.app))
        .catch(Common.oops(ctx, true))
    })

    it(`should create sample pod from local file via ${kubectl}`, () => {
      return impl
        .do(`${kubectl} create -f ${ROOT}/data/k8s/headless/pod2.yaml ${inNamespace}`, ctx.app)
        .then(impl.expectOK('nginx2'))
        .catch(Common.oops(ctx, true))
    })

    it(`should delete the namespace ${ns} `, () => {
      return impl
        .do(`${kubectl} delete namespace ${ns}`, ctx.app)
        .then(impl.expectOK(`namespace "${ns}" deleted`))
        .catch(Common.oops(ctx, true))
    })
  })
}

Common.localDescribe('headless create pod kubectl kui mode', function(this: Common.ISuite) {
  doHeadless(this, kubectl)
})

Common.localDescribe('headless create pod bin/kui mode', function(this: Common.ISuite) {
  doHeadless(this, kui)
})
