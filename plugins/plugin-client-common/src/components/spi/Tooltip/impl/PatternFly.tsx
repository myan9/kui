/*
 * Copyright 2021 The Kubernetes Authors
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
import Props, { isMarkdownProps, isReferenceProps } from '../model'

import Markdown from '../../../Content/Markdown'
import { Tooltip } from '@patternfly/react-core'

import '../../../../../web/scss/components/Tooltip/PatternFly.scss'

export default function PatternFlyTooltip(props: Props): React.ReactElement {
  const isMarkdown = isMarkdownProps(props)

  return (
    <Tooltip
      className="kui--tooltip"
      isContentLeftAligned={isMarkdown}
      position={props.position || 'auto'}
      entryDelay={props.entryDelay || 200}
      data-is-markdown={isMarkdown || undefined}
      reference={isReferenceProps(props) && props.reference}
      content={
        isReferenceProps(props) ? (
          props.children
        ) : isMarkdownProps(props) ? (
          <Markdown nested source={props.markdown} />
        ) : (
          props.content
        )
      }
    >
      {!isReferenceProps(props) && <React.Fragment>{props.children}</React.Fragment>}
    </Tooltip>
  )
}
