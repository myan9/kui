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
import { Accordion, AccordionItem } from 'carbon-components-react'

import { eventBus, getPrimaryTabId, i18n } from '@kui-shell/core'

import Props from '../model'

import '../../../../../web/scss/components/Accordion/Carbon.scss'

const strings = i18n('plugin-client-common')

interface State {
  expandedIdx: number
}

export default class CarbonAccordion extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      expandedIdx: this.props.items.findIndex(_ => _.expandedByDefault)
    }
  }

  public render() {
    return (
      <Accordion className={`kui--accordion ${this.props.isWidthConstrained ? 'flex-fill' : ''}`}>
        {this.props.items.map((item, idx) => (
          <AccordionItem
            className={'kui--accordion-item'}
            open={this.state.expandedIdx === idx}
            key={idx}
            title={item.label || (this.state.expandedIdx !== idx ? strings('Show X', item.name) : strings('Hide X', item.name))}
            onClick={() => {
              this.setState(curState => ({ expandedIdx: curState.expandedIdx !== idx ? idx : -1 }))
              eventBus.emitTabLayoutChange(getPrimaryTabId(this.props.tab))
            }}
          >
            {item.content}
          </AccordionItem>
        ))}
      </Accordion>
    )
  }
}
