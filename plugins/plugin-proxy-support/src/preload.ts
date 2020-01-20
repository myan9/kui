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

import Debug from 'debug'

import { CapabilityRegistration, inBrowser, assertHasProxy, assertLocalAccess, setEvaluatorImpl } from '@kui-shell/core'
import { proxyServer } from '@kui-shell/client/config.d/proxy.json'

import { isDisabled } from './lib/config'

const debug = Debug('plugins/proxy-support/preload')

/**
 * This is the capabilities registraion
 *
 */
export const registerCapability: CapabilityRegistration = async () => {
  if (inBrowser()) {
    debug('config', proxyServer)

    if (!isDisabled(proxyServer)) {
      // notify the Capabilities manager that we have extended the
      // capabilities of Kui
      assertHasProxy()
      assertLocalAccess()
    }
  }
}

/**
 * This is the module
 *
 */
export default async () => {
  if (inBrowser()) {
    debug('config', proxyServer)

    if (!isDisabled(proxyServer)) {
      const ProxyEvaluator = (await import('./lib/proxy-executor')).default

      debug('attempting to establish our proxy executor')
      setEvaluatorImpl(new ProxyEvaluator())
    }
  }
}
