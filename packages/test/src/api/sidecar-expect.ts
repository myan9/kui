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

import { Application } from 'spectron'
import { timeout, waitTimeout, expectSubset, expectStruct } from './util'
import { selectors } from '../../ui'

export const open = async (app: Application) => {
  await app.client.waitForVisible(selectors.SIDECAR, timeout)
  return app
}

export const expectOpenWithFailure = async (app: Application) => {
  return app.client.waitForVisible(selectors.SIDECAR_WITH_FAILURE, timeout).then(() => app)
}

/** expect open fullscreen */
export const expectFullscreen = async (app: Application) => {
  return app.client.waitForVisible(selectors.SIDECAR_FULLSCREEN, timeout).then(() => app)
}

/** either minimized or fully closed */
export const closed = async (app: Application) => {
  await app.client.waitForExist(selectors.SIDECAR_HIDDEN, timeout).then(() => app)
  await new Promise(resolve => setTimeout(resolve, 600)) // wait for the transition effect
}

/** fully closed, not just minimized */
export const expectFullyClosed = async (app: Application) => {
  return app.client.waitForExist(selectors.SIDECAR_FULLY_HIDDEN, timeout).then(() => app)
}

export const expectSourceStruct = (expectedJSON: object) => async (app: Application) => {
  return app.client
    .getText(selectors.SIDECAR_ACTION_SOURCE)
    .then(expectStruct(expectedJSON))
    .then(() => app)
}

export const expectSourceSubset = (expectedJSON: object) => async (app: Application) => {
  return app.client
    .getText(selectors.SIDECAR_ACTION_SOURCE)
    .then(expectSubset(expectedJSON))
    .then(() => app)
}

export const expectSource = (expectedSource: string) => async (app: Application) => {
  return app.client
    .waitUntil(async () => {
      const actualSource = await app.client.getText(selectors.SIDECAR_ACTION_SOURCE)
      return actualSource.replace(/\s+/g, '') === expectedSource.replace(/\s+/g, '')
    }, waitTimeout)
    .then(() => app)
}

export const expectResult = (expectedResult: object, failFast?: boolean) => async (app: Application) => {
  return app.client
    .getText(selectors.SIDECAR_ACTIVATION_RESULT)
    .then(expectStruct(expectedResult, undefined, failFast))
    .then(() => app)
}

export const expectResultSubset = (expectedResult: object, failFast?: boolean) => async (app: Application) => {
  await app.client.getText(selectors.SIDECAR_ACTIVATION_RESULT).then(expectSubset(expectedResult, failFast))
  return app
}

export const expectBadge = (badge: string) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    const badges = await app.client.getText(selectors.SIDECAR_BADGES)
    return badges.indexOf(badge) >= 0
  })
  return app
}

export const expectLimit = (type: string, expectedValue: number | string) => async (app: Application) => {
  const expect = {}
  expect[type] = expectedValue

  return app.client
    .click(selectors.SIDECAR_MODE_BUTTON('limits'))
    .then(() => app.client.getText(selectors.SIDECAR_ACTION_SOURCE))
    .then(expectSubset(expect))
}

export const expectSequence = (A: Array<string>) => (app: Application) => {
  return Promise.all(
    A.map((component, idx) => {
      const selector = `${selectors.SIDECAR_SEQUENCE_CANVAS_NODE_N(idx)}[data-name="/_/${component}"]`
      console.error(`Waiting for ${selector}`)
      return app.client.waitForExist(selector)
    })
  )
}

export const expectMode = (expectedMode: string) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    await app.client.waitForVisible(`${selectors.SIDECAR_MODE_BUTTON(expectedMode)}.bx--tabs__nav-item--selected`)
    return true
  })

  return app
}

export const expectShowing = (
  expectedName: string,
  expectedActivationId?: string,
  expectSubstringMatchOnName?: boolean,
  expectedPackageName?: string,
  expectType?: string,
  waitThisLong?: number
) => async (app: Application) => {
  await app.client.waitUntil(
    async () => {
      // check selected name in sidecar
      return app.client
        .waitForVisible(`${selectors.SIDECAR}${!expectType ? '' : '.entity-is-' + expectType}`)
        .then(() => app.client.waitForText(selectors.SIDECAR_TITLE, timeout))
        .then(() => app.client.getText(selectors.SIDECAR_TITLE))
        .then(name => {
          const nameMatches = expectSubstringMatchOnName
            ? name.indexOf(expectedName) >= 0 || expectedName.indexOf(name) >= 0
            : name === expectedName
          if (nameMatches) {
            if (expectedPackageName) {
              return app.client
                .getText(selectors.SIDECAR_PACKAGE_NAME_TITLE)
                .then(name =>
                  expectSubstringMatchOnName
                    ? name.search(new RegExp(expectedPackageName, 'i')) >= 0
                    : name.toLowerCase() === expectedPackageName.toLowerCase()
                )
            } else {
              return true
            }
          }
        })
    },
    waitThisLong,
    `expect action name ${expectedName} in sidecar substringOk? ${expectSubstringMatchOnName}`
  )

  if (expectedActivationId) {
    await app.client.waitUntil(
      async () =>
        app.client
          .waitForText(selectors.SIDECAR_ACTIVATION_TITLE, timeout)
          .then(() => app.client.getText(selectors.SIDECAR_ACTIVATION_TITLE))
          .then(id => id === expectedActivationId),
      timeout,
      `expect activation id ${expectedActivationId} in sidecar`
    )
  }

  return app
}
