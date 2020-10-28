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
import { Accordion, AccordionItem, AccordionToggle, AccordionContent } from '@patternfly/react-core'

import { eventBus, getPrimaryTabId, i18n } from '@kui-shell/core'

import Props from '../model'

import '../../../../../web/scss/components/Accordion/PatternFly.scss'

const strings = i18n('plugin-client-common')

interface State {
  expandedIdx: number
}

export default class PatternFlyAccordion extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      expandedIdx: this.props.items.findIndex(_ => _.expandedByDefault)
    }
  }

  public render() {
    return (
      <Accordion
        asDefinitionList={false}
        className={`kui--accordion ${this.props.isWidthConstrained ? 'flex-fill' : ''}`}
      >
        {this.props.items.map((item, idx) => (
          <AccordionItem key={idx}>
            <AccordionToggle
              id={idx.toString()}
              onClick={() => {
                this.setState(curState => ({ expandedIdx: curState.expandedIdx !== idx ? idx : -1 }))
                eventBus.emitTabLayoutChange(getPrimaryTabId(this.props.tab))
              }}
              isExpanded={this.state.expandedIdx === idx}
            >
              {item.label || (this.state.expandedIdx !== idx ? strings('Show X', item.name) : strings('Hide X', item.name))}
            </AccordionToggle>
            <AccordionContent isHidden={this.state.expandedIdx !== idx}>
              {item.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }
}
