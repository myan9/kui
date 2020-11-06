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

import React from 'react'
import { Button, ResourceWithMetadata, isViewButton, MultiModalResponse, ParsedOptions } from '@kui-shell/core'

import LocationProps from './Location'

type Props = LocationProps & {
  button: Button
  response: MultiModalResponse
  args: {
    argvNoOptions: string[]
    parsedOptions: ParsedOptions
  }
}

export default class ToolbarButton<T extends ResourceWithMetadata = ResourceWithMetadata> extends React.PureComponent<
  Props
> {
  private getCommand() {
    const { tab, response, button, args } = this.props
    if (isViewButton(button)) {
      return button.command
    } else {
      const cmd = typeof button.command === 'string' ? button.command : button.command(tab, response, args)
      if (button.confirm) {
        return `confirm "${cmd}"`
      } else {
        return cmd
      }
    }
  }

  private async buttonOnclick() {
    const cmd = await this.getCommand()
    const { tab, execUUID, response, button, args } = this.props

    if (typeof cmd === 'string') {
      if (isViewButton(button) || button.confirm) {
        return tab.REPL.qexec(cmd, undefined, undefined, { rethrowErrors: true })
      } else {
        if (button.inPlace) {
          return tab.REPL.reexec(cmd, { execUUID })
        } else {
          return tab.REPL.pexec(cmd)
        }
      }
    } else if (typeof cmd === 'function') {
      cmd(tab, response, args)
    } else {
      // e.g. this happens for kubectl edit on apply error, this is
      // because the error handling is captured by the
      // Editor/index.tsx
    }
  }

  private readonly _buttonOnclick = this.buttonOnclick.bind(this)

  public render() {
    const { button } = this.props

    return (
      <span
        className={
          'kui--tab-navigatable kui--notab-when-sidecar-hidden sidecar-bottom-stripe-button-as-button sidecar-bottom-stripe-button' +
          (button.icon ? ' kui--toolbar-button-with-icon' : '')
        }
        data-mode={button.mode}
      >
        <button role="presentation" onClick={this._buttonOnclick}>
          <span role="tab" title={button.label || button.mode}>
            {button.icon ? button.icon : button.label || button.mode}
          </span>
        </button>
      </span>
    )
  }
}
