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
import { REPL } from '@kui-shell/core'
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core'

import { TopNavBreadcrumb } from './TopNavBreadcrumb'

import '@patternfly/react-core/dist/styles/base.css'
import '../../../../web/scss/components/Patternfly/Breadcrumb.scss'

interface Props {
  breadcrumbs: TopNavBreadcrumb[]
  currentPageIdx: number
  repl: REPL
}

export default class PatternflyBreadcrumb extends React.PureComponent<Props> {
  public render() {
    return (
      <Breadcrumb>
        {this.props.breadcrumbs.map((_, idx) => (
          <BreadcrumbItem
            to="#"
            key={idx}
            className={[_.className, _.deemphasize && 'kui--secondary-breadcrumb', 'zoomable'].filter(_ => _).join(' ')}
            isActive={idx === this.props.currentPageIdx}
            onClick={_.command && (() => this.props.repl.pexec(_.command))}
          >
            {_.command ? <a href="#">{_.label}</a> : <span>{_.label}</span>}
          </BreadcrumbItem>
        ))}
      </Breadcrumb>
    )
  }
}
