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

import * as assert from 'assert'
import { Application } from 'spectron'

import { timeout, waitTimeout } from './cli'
import * as Selectors from './selectors'
import { keys as Keys } from './keys'
import { expectArray, expectSubset, expectStruct, expectText, getValueFromMonaco, expectYAMLSubset } from './util'

export const open = async (app: Application) => {
  await app.client.waitForVisible(Selectors.SIDECAR, timeout)
  return app
}

export const openWithFailure = async (app: Application) => {
  return app.client.waitForVisible(Selectors.SIDECAR_WITH_FAILURE, waitTimeout).then(() => app)
}

/** expect open fullscreen */
export const fullscreen = async (app: Application) => {
  return app.client.waitForVisible(Selectors.SIDECAR_FULLSCREEN, waitTimeout).then(() => app)
}

/** fully closed, not just minimized */
export const fullyClosed = async (app: Application) => {
  return app.client.waitForExist(Selectors.SIDECAR_FULLY_CLOSED).then(() => app)
}

/** either minimized or fully closed */
export const closed = async (app: Application) => {
  return fullyClosed(app)
}

/** close the sidecar by ESCAPE key */
export const keyToClose = async (app: Application) => {
  await app.client.keys(Keys.ESCAPE)
  return closed(app)
}

export const sourceStruct = (expectedJSON: Record<string, any>) => async (app: Application) => {
  return app.client
    .getText(Selectors.SIDECAR_ACTION_SOURCE)
    .then(expectStruct(expectedJSON))
    .then(() => app)
}

export const sourceSubset = (expectedJSON: Record<string, any>) => async (app: Application) => {
  return app.client
    .getText(Selectors.SIDECAR_ACTION_SOURCE)
    .then(expectSubset(expectedJSON))
    .then(() => app)
}

export const source = (expectedSource: string) => async (app: Application) => {
  return app.client
    .waitUntil(async () => {
      const actualSource = await app.client.getText(Selectors.SIDECAR_ACTION_SOURCE)
      return actualSource.replace(/\s+/g, '') === expectedSource.replace(/\s+/g, '')
    }, waitTimeout)
    .then(() => app)
}

export const result = (expectedResult: Record<string, any>, failFast?: boolean) => async (app: Application) => {
  return app.client
    .getText(Selectors.SIDECAR_ACTIVATION_RESULT)
    .then(expectStruct(expectedResult, undefined, failFast))
    .then(() => app)
}

export const resultSubset = (expectedResult: Record<string, any>, failFast?: boolean) => async (app: Application) => {
  await app.client.getText(Selectors.SIDECAR_ACTIVATION_RESULT).then(expectSubset(expectedResult, failFast))
  return app
}

export const badge = (title: string, css?: string, absent = false) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    const badges = css
      ? await app.client.getText(`${Selectors.SIDECAR_BADGES} .${css}`)
      : await app.client.getText(Selectors.SIDECAR_BADGES)

    const idx = badges.indexOf(title)
    return !absent ? idx >= 0 : idx < 0
  }, waitTimeout)
  return app
}

export const button = (button: { mode: string; label?: string }) => async (app: Application) => {
  await app.client.waitForVisible(Selectors.SIDECAR_TOOLBAR_BUTTON(button.mode))
  return app
}

export const limit = (type: string, expectedValue: number | string) => async (app: Application) => {
  const expect: Record<string, number | string> = {}
  expect[type] = expectedValue

  return app.client
    .click(Selectors.SIDECAR_MODE_BUTTON('limits'))
    .then(() => app.client.getText(Selectors.SIDECAR_ACTION_SOURCE))
    .then(expectSubset(expect))
}

export const sequence = (A: Array<string>) => (app: Application) => {
  return Promise.all(
    A.map((component, idx) => {
      const selector = `${Selectors.SIDECAR_SEQUENCE_CANVAS_NODE_N(idx)}[data-name="/_/${component}"]`
      console.error(`Waiting for ${selector}`)
      return app.client.waitForExist(selector)
    })
  )
}

export const mode = (expectedMode: string) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    await app.client.waitForVisible(`${Selectors.SIDECAR_MODE_BUTTON(expectedMode)}.bx--tabs__nav-item--selected`)
    return true
  }, waitTimeout)

  return app
}

export const toolbarText = (expect: { type: string; text: string; exact?: boolean }) => async (app: Application) => {
  await expectText(app, expect.text, expect.exact)(Selectors.SIDECAR_TOOLBAR_TEXT(expect.type))
  return app
}

export const toolbarAlert = (expect: { type: string; text: string; exact?: boolean }) => async (app: Application) => {
  await expectText(app, expect.text, expect.exact)(Selectors.SIDECAR_ALERT(expect.type))
  return app
}

const show = (expected: string, selector: string) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    return app.client
      .then(() => app.client.waitForText(selector, timeout))
      .then(() => app.client.getText(selector))
      .then((text) => text === expected)
  }, waitTimeout)

  return app
}

export const name = (expectedName: string) => show(expectedName, Selectors.SIDECAR_TITLE)

export const heroName = (expectedName: string) => show(expectedName, Selectors.SIDECAR_HERO_TITLE)

export const namehash = (expectedNameHash: string) => show(expectedNameHash, Selectors.SIDECAR_ACTIVATION_TITLE)

export const namespace = (expectedNamespace: string) => show(expectedNamespace, Selectors.SIDECAR_PACKAGE_NAME_TITLE)

export const kind = (expectedKind: string) => show(expectedKind, Selectors.SIDECAR_KIND)

// expect sidecar tabs have correct `mode` and `label`
export const modes = (expected: { mode: string; label?: string; dafaultMode?: boolean }[]) => async (
  app: Application
) =>
  Promise.all(
    expected.map(async (_) => {
      await app.client.waitUntil(async () => {
        const actualMode = `${Selectors.SIDECAR_MODE_BUTTON(_.mode)}`
        await app.client.waitForExist(actualMode)

        if (_.label && (await app.client.isVisible(actualMode))) {
          const actualLabel = await app.client.getText(actualMode)
          return actualLabel.toLowerCase() === _.label.toLowerCase()
        } else {
          return true
        }
      }, waitTimeout)
    })
  ).then(() => app)

// expect sidecar tab has the correct default tab
export const defaultMode = (expected: { mode: string; label?: string }) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    const actualMode = `${Selectors.SIDECAR_MODE_BUTTON_SELECTED(expected.mode)}`
    await app.client.waitForVisible(actualMode)

    if (expected.label) {
      const actualLabel = await app.client.getText(actualMode)
      return actualLabel.toLowerCase() === expected.label.toLowerCase()
    } else {
      return true
    }
  }, waitTimeout)

  return app
}

export const textPlainContent = (content: string) => async (app: Application) => {
  await expectText(app, content)(Selectors.SIDECAR_CUSTOM_CONTENT)
  return app
}

export const textPlainContentFromMonaco = (expectedText: string, exact = true) => async (app: Application) => {
  let idx = 0
  await app.client.waitUntil(async () => {
    const actualText = await getValueFromMonaco(app)
    if (++idx > 5) {
      console.error(`still waiting for plain text from monaco actualText=${actualText} expectedText=${expectedText}`)
    }

    if (exact) {
      return actualText === expectedText
    } else {
      return actualText.indexOf(expectedText) >= 0
    }
  }, waitTimeout)

  return app
}

export async function tableContent(app: Application, nRows: number, nCells: number) {
  const rows = (await app.client.elements(`${Selectors.SIDECAR_CUSTOM_CONTENT} tr`)).value
  assert.strictEqual(nRows, rows.length, 'nRows must match')

  const cells = (await app.client.elements(`${Selectors.SIDECAR_CUSTOM_CONTENT} td`)).value
  assert.strictEqual(nCells, cells.length, 'nCells must match')
}

export const yaml = (content: Record<string, any>) => async (app: Application) => {
  await app.client.waitUntil(async () => {
    const ok: boolean = await getValueFromMonaco(app).then(expectYAMLSubset(content, false))
    return ok
  }, waitTimeout)

  return app
}

export async function popupTitle(app: Application, expectedTitle: string) {
  return app.client.waitUntil(async () => {
    const actualTitle = await app.client.getText(Selectors.SIDECAR_POPUP_HERO_TITLE)
    return actualTitle === expectedTitle
  }, waitTimeout)
}

/** expect a form in the sidecar content */
export function form(form: Record<string, string>, idPrefix = 'kui-form') {
  return async (app: Application) => {
    await Promise.all(
      Object.keys(form).map((key) => {
        return app.client.waitUntil(async () => {
          const expectedValue = form[key]
          const actualValue = await app.client.getValue(`${Selectors.SIDECAR_TAB_CONTENT} #${idPrefix}-${key}`)
          return actualValue === expectedValue
        }, waitTimeout)
      })
    )

    return app
  }
}

export const showing = (
  expectedName: string,
  expectedActivationId?: string,
  expectSubstringMatchOnName?: boolean,
  expectedPackageName?: string,
  expectType?: string,
  waitThisLong?: number,
  which?: 'leftnav' | 'topnav'
) => async (app: Application): Promise<Application> => {
  await app.client.waitUntil(
    async () => {
      // check selected name in sidecar
      const sidecarSelector = `${Selectors.SIDECAR}${!expectType ? '' : '.entity-is-' + expectType}`
      await app.client.waitForVisible(sidecarSelector)

      // either 'leftnav' or 'topnav'
      if (!which) {
        which = await app.client.getAttribute(sidecarSelector, 'data-view')
      }
      const titleSelector = which === 'topnav' ? Selectors.SIDECAR_TITLE : Selectors.SIDECAR_LEFTNAV_TITLE

      return app.client
        .waitForText(titleSelector, timeout)
        .then(() => app.client.getText(titleSelector))
        .then((name) => {
          const nameMatches = expectSubstringMatchOnName
            ? name.indexOf(expectedName) >= 0 || expectedName.indexOf(name) >= 0
            : name === expectedName
          if (nameMatches) {
            if (expectedPackageName) {
              return app.client
                .getText(Selectors.SIDECAR_PACKAGE_NAME_TITLE)
                .then((name) =>
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
      async () => {
        try {
          const actualId = await app.client.getText(Selectors.SIDECAR_ACTIVATION_TITLE)
          if (actualId === expectedActivationId) {
            return true
          } else {
            console.error(`still waiting for nameHash; currently "${actualId}"; expecting "${expectedActivationId}"`)
          }
        } catch (err) {
          console.error(`error waiting for nameHash ${err.message}`, err)
        }
      },
      waitTimeout,
      `expect activation id ${expectedActivationId} in sidecar`
    )
  }

  return app
}

export const showingTopNav = (expectedName: string) =>
  showing(expectedName, undefined, undefined, undefined, undefined, undefined, 'topnav')

export const showingLeftNav = (expectedName: string) =>
  showing(expectedName, undefined, undefined, undefined, undefined, undefined, 'leftnav')

export function breadcrumbs(breadcrumbs: string[]) {
  return async (app: Application) => {
    await app.client.waitForVisible(Selectors.SIDECAR_BREADCRUMBS)
    await app.client.getText(Selectors.SIDECAR_BREADCRUMBS)
    await expectArray(breadcrumbs)

    return app
  }
}
