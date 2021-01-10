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

import { Arguments, Registrar, eventChannelUnsafe } from '@kui-shell/core'

import flags from './flags'
import { doExecWithPty } from './exec'
import commandPrefix from '../command-prefix'
import { KubeOptions, getNamespaceAsExpressed } from './options'

const kubectlConfigChangeChannel = '/kubectl/config/change'
type Change = 'NewContext' | 'AlteredContext'
type Handler = (type: 'SetNamespaceOrContext' | 'CreateOrDeleteNamespace', namespace?: string) => void

const mutators = [
  'delete-cluster',
  'delete-context',
  'rename-context',
  'set',
  'set-cluster',
  'set-context',
  'set-credentials',
  'unset',
  'use-context'
]

export function emitKubectlConfigChangeEvent(
  type: 'SetNamespaceOrContext' | 'CreateOrDeleteNamespace',
  namespace?: string
) {
  try {
    eventChannelUnsafe.emit(kubectlConfigChangeChannel, type, namespace)
  } catch (err) {
    console.error('Error in onKubectlConfigChangeEvent handler', err)
  }
}

export function onKubectlConfigChangeEvents(handler: Handler) {
  eventChannelUnsafe.on(kubectlConfigChangeChannel, handler)
}

export function offKubectlConfigChangeEvents(handler: Handler) {
  eventChannelUnsafe.off(kubectlConfigChangeChannel, handler)
}

/**
 * Here, we conservatively broadcoast that the kubectl config *may*
 * have changed.
 *
 */
async function doConfig(args: Arguments<KubeOptions>) {
  const response = await doExecWithPty(args)

  const idx = args.argvNoOptions.indexOf('config')
  const verb = args.argvNoOptions[idx + 1]
  const change =
    verb === 'set' || verb === 'use-context' || (verb === 'set-context' && !args.parsedOptions.current)
      ? 'NewContext'
      : verb === 'set-context' || verb === 'set-cluster' || verb === 'set-credentials' || verb === 'rename-context'
      ? 'AlteredContext'
      : undefined

  if (change) {
    emitKubectlConfigChangeEvent('SetNamespaceOrContext', getNamespaceAsExpressed(args))
  }

  return response
}

export function register(registrar: Registrar, cmd: string) {
  mutators.forEach(verb => {
    registrar.listen(`/${commandPrefix}/${cmd}/config/${verb}`, doConfig, flags)
  })
}

/**
 * Register the commands
 *
 */
export default (registrar: Registrar) => {
  register(registrar, 'kubectl')
  register(registrar, 'k')
}
