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

import * as React from 'react'
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardHeaderMain,
  CardTitle,
  Dropdown,
  DropdownItem,
  KebabToggle
} from '@patternfly/react-core'

import Props from '../model'
import { DropDownAction } from '../../DropDown'

import '../../../../../web/scss/components/Card/Patternfly.scss'

interface State {
  isOpen: boolean
}

export default class PatternflyCard extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      isOpen: false
    }
  }

  private renderDropDownItems(actions: DropDownAction[]) {
    return actions.map((item, idx) => (
      <DropdownItem key={idx} component="button" onClick={item.handler} data-mode={item.label}>
        {item.label}
      </DropdownItem>
    ))
  }

  private cardActions() {
    return (
      <CardActions>
        <Dropdown
          onSelect={() => this.setState({ isOpen: !this.state.isOpen })}
          toggle={
            <KebabToggle
              onToggle={isOpen => {
                this.setState({ isOpen })
              }}
            />
          }
          isOpen={this.state.isOpen}
          isPlain
          dropdownItems={this.renderDropDownItems(this.props.actions)}
          position={'right'}
        />
      </CardActions>
    )
  }

  private icon () {
   // <Brand src={this.props.icon} alt="card icon" style={{ height: '50px' }}/>
  }

  public render() {
    const needsHeader = this.props.header || this.props.actions || this.props.icon
    
    return (
      <Card className={this.props.className}>
        {React.Children.count(this.props.children) > 0 && (
          <React.Fragment>
            {needsHeader && (
              <CardHeader>
                <CardHeaderMain>
                  {this.props.header}
                  {this.props.icon && this.icon()}
                </CardHeaderMain>
                {this.props.actions && this.cardActions()}
              </CardHeader>
            )}
            {this.props.title && <CardTitle> {this.props.title} </CardTitle>}
            <CardBody>{this.props.children}</CardBody>
          </React.Fragment>
        )}
      </Card>
    )
  }
}
