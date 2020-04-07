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

import { ViewLevel, TextWithIconWidget } from '@kui-shell/plugin-client-common'

interface Props {
  className?: string
}

interface State {
  text: string
  viewLevel: ViewLevel
}

export default class DogWidget extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      text: '',
      viewLevel: 'normal'
    }
  }

  public render() {
    return (
      <TextWithIconWidget
        className={this.props.className}
        text={'🐶'}
        viewLevel={this.state.viewLevel}
        id="kui--plugin-git--current-git-branch"
        textOnclick="hello dog"
        iconOnclick="hello cat"
      >
        {'🐱'}
      </TextWithIconWidget>
    )
  }
}
