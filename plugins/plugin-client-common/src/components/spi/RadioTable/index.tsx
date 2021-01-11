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
import { i18n, pexecInCurrentTab, radioTableCellToString } from '@kui-shell/core'

import Props from './model'
import DropDown from '../DropDown'

const strings = i18n('plugin-client-common')

export interface State {
  selectedIdx: number
}

export default class RadioTableSpi extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = { selectedIdx: props.table.defaultSelectedIdx }
  }

  public render() {
    const title = strings('theme list')
    const actions = this.props.table.body.map((_, idx) => {
      return {
        label: radioTableCellToString(_.cells[_.nameIdx]),
        isSelected: this.state.selectedIdx === idx,
        handler: () => pexecInCurrentTab(_.onSelect)
      }
    })
    return <DropDown isPlain toggle="caret" direction="down" actions={actions} title={title} position="left" />
  }
}
