/*
 * Copyright 2017-2018 IBM Corporation
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

import * as Debug from 'debug'
const debug = Debug('plugins/openwhisk/models/auth')
debug('loading')

import openwhisk = require('openwhisk')

import { inBrowser, getAuthValue, setHasAuth } from '@kui-shell/core/core/capabilities'
import { getDefaultCommandContext } from '@kui-shell/core/core/command-tree'

let wskprops
try {
  const propertiesParser = require('properties-parser')
  const expandHomeDir = require('expand-home-dir')
  if (!inBrowser()) {
    wskprops = propertiesParser.read(expandHomeDir(process.env['WSK_CONFIG_FILE'] || '~/.wskprops'))
  } else {
    // then we're running in a browser; we'll initialize this
    // later. clearly there is no local filesystem from which to pull
    // the openwhisk config
    wskprops = {}
  }
} catch (e) {
  wskprops = {}
  if (e.code === 'ENOENT') {
    debug('Could not find wskprops')
  } else {
    console.error(e)
  }
}

debug('wskprops loaded')

/**
 * keys into the localStorage map
 *
 */
const localStorageKey = {
  host: 'wsk.apihost',
  ignoreCerts: 'wsk.apihost.ignoreCerts',
  auth: 'wsk.auth'
}

/**
 *
 *
 */
export let apihost = process.env.__OW_API_HOST || wskprops.APIHOST || window.localStorage.getItem(localStorageKey.host) || getAuthValue('openwhisk', 'apihost')

let authKey = process.env.__OW_API_KEY || wskprops.AUTH || window.localStorage.getItem(localStorageKey.auth) || getAuthValue('openwhisk', 'api_key')

let apigw_token = process.env.__OW_APIGW_TOKEN || wskprops.APIGW_ACCESS_TOKEN || 'localhostNeedsSomething' // tslint:disable-line

let apigw_space_guid = process.env.__OW_APIGW_SPACE_GUID || wskprops.APIGW_SPACE_GUID // tslint:disable-line
export let ow

let userRequestedIgnoreCerts = window.localStorage.getItem(localStorageKey.ignoreCerts) !== undefined
let ignoreCerts = apiHost => userRequestedIgnoreCerts || apiHost.indexOf('localhost') >= 0 || apiHost.startsWith('192.') || apiHost.startsWith('172.') || process.env.IGNORE_CERTS || wskprops.INSECURE_SSL

export const initOWFromConfig = (owConfig) => {
  debug('initOWFromConfig', owConfig)

  if (owConfig.api_key !== 'unknown') {
    setHasAuth('openwhisk', owConfig)
  }

  debug('initOW', owConfig)
  const ow = openwhisk(owConfig)
  ow['api'] = ow.routes
  delete ow.routes
  debug('initOW done')

  if (owConfig.api_key !== 'unknown' && window && window.localStorage && window.localStorage.setItem) {
    window.localStorage.setItem(localStorageKey.auth, owConfig.api_key) // remember the choice in localStorage
  }

  return ow
}

export const initOW = () => {
  if (!apihost || !authKey) {
    debug('faking out openwhisk config for now')
  }

  const owConfig = {
    apihost: apihost || 'unknown',
    api_key: authKey || 'unknown',
    apigw_token,
    apigw_space_guid,
    ignore_certs: ignoreCerts(apihost)
  }

  ow = initOWFromConfig(owConfig)
}
if (getDefaultCommandContext()[0] === 'wsk' && getDefaultCommandContext()[1] === 'action') {
  initOW()
}

export const apiHost = {
  get: () => Promise.resolve(apihost),
  set: (newHost, { ignoreCerts = false } = {}) => {
    const url = require('url').parse(newHost)
    if (!url.protocol) {
      if (newHost.indexOf('localhost') >= 0 || newHost.indexOf('192.168') >= 0) {
        newHost = `http://${newHost}`
      } else {
        newHost = `https://${newHost}`
      }
    }
    apihost = newHost // global variable
    userRequestedIgnoreCerts = ignoreCerts
    window.localStorage.setItem(localStorageKey.host, newHost) // remember the choice in localStorage
    window.localStorage.setItem(localStorageKey.ignoreCerts, userRequestedIgnoreCerts.toString())
    authKey = undefined
    initOW() // re-initialize the openwhisk npm
    debug('apiHost::set', apihost)
    return Promise.resolve(newHost)
  }
}

export const auth = {
  get: () => authKey,
  getSubjectId: () => authKey.split(/:/)[0] || authKey, // if authKey is x:y, return x, otherwise return auth
  set: (newAuthKey: string): Promise<boolean> => {
    const needReinit = !ow

    authKey = newAuthKey
    initOW()

    debug('set', auth)
    return Promise.resolve(needReinit)
  }
}
