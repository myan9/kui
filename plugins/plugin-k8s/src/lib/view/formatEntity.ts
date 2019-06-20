/*
 * Copyright 2018 IBM Corporation
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

import eventBus from '@kui-shell/core/core/events'

import { toOpenWhiskFQN } from '../util/util'
import { States, FinalState, watchStatus, rendering as stateRendering } from '../model/states'

const debug = require('debug')('k8s/util/formatEntity')

/**
 * Make a kube context attribute
 *
 */
export const formatContextAttr = (context: string, extraCSS?: string) => {
  return [{
    key: 'context',
    value: context,
    outerCSS: `${extraCSS ? extraCSS + ' ' : ''}entity-name-group entity-name-group-narrow hide-with-sidecar`
  }]
}

/**
 * Return a repl attribute for the given readiness
 *
 */
export const formatEntity = (parsedOptions, context?: string) => async (kubeEntity) => {
  debug('formatEntity', kubeEntity)

  const doWatch = true
  const finalState = parsedOptions['final-state'] || FinalState.NotPendingLike

  const { apiVersion, kind, metadata: { name, namespace, labels, annotations = {} } } = kubeEntity
  const { type, actionName, packageName, fqn } = toOpenWhiskFQN(kubeEntity)
  const { outerCSS, cssForState } = stateRendering

  // masquerade: allows the spec to override/pretty-print certain fields
  const title = annotations['seed.ibm.com/title']
  const targetNamespace = annotations['seed.ibm.com/targetNamespace']
  const masqueradeKind = annotations['seed.ibm.com/category']

  const kindForDisplay = masqueradeKind || kind

  const kindAttr: any[] = [{ key: 'kind', value: kindForDisplay, outerCSS: 'entity-kind' }]
  const contextAttr = parsedOptions.multi || !context ? []
    : formatContextAttr(context)

  // see if anyone else changes the expected final state
  const watch = { apiVersion, kind, name, namespace, type, fqn, context, labels }
  const eventType = '/kubectl/state/expect'
  const listener = ({ watch: other, finalState: otherFinalState }) => {
    if (watch.kind === other.kind &&
        watch.name === other.name &&
        watch.context === other.context &&
        finalState !== otherFinalState) {
      debug('conflicting final states', watch, finalState, otherFinalState)

      eventBus.removeListener(eventType, listener)
    }
  }
  eventBus.on(eventType, listener)

  // let everyone know that this resource has a new expected final state
  eventBus.emit('/kubectl/state/expect', { watch, finalState })

  const namespaceAttrs = !watch.kind || watch.kind.match(/(ns|Namespace)/i) ? [] : [{
    key: 'namespace',
    value: targetNamespace || namespace,
    outerCSS: 'pretty-narrow hide-with-sidecar'
  }]

  return Promise.resolve(watchStatus(watch, finalState))
    .then(statuss => {
      debug('statuss', statuss)

      const statusAttrs = parsedOptions['no-status'] ? [] : [
        {
          key: 'status',
          value: statuss.value,
          placeholderValue: true, // allows headless to make an informed rendering decision
          tag: 'badge',
          // watch: !doWatch ? undefined : (iter: number) => {
          //   const watchResponse = watchStatus(watch, finalState, iter)
          //   watchResponse.then(({ done }) => {
          //     if (done) {
          //       eventBus.removeListener(eventType, listener)
          //     }
          //   })
          //   debug('watch response', watchResponse)
          //   return watchResponse
          // },
          outerCSS,
          css: cssForState(statuss.value)
        },

        {
          key: 'message',
          value: '',
          css: 'somewhat-smaller-text slightly-deemphasize',
          outerCSS: 'hide-with-sidecar not-too-wide min-width-date-like'
        }
      ]

      const attributes: any[] = kindAttr.concat(contextAttr)
        .concat(namespaceAttrs)
        .concat(statusAttrs)

      debug('hei', Object.assign({}, kubeEntity, {
        type: 'status',
        prettyType: kindForDisplay,
        name: title || actionName || fqn,
        packageName,
        noSort: true,
        onclick: parsedOptions.onclickFn ? parsedOptions.onclickFn(kubeEntity) : false,
        attributes
      }))

      return Object.assign({}, kubeEntity, {
        type: 'status',
        prettyType: kindForDisplay,
        name: title || actionName || fqn,
        packageName,
        noSort: true,
        onclick: parsedOptions.onclickFn ? parsedOptions.onclickFn(kubeEntity) : false,
        attributes
      })
    })
}
