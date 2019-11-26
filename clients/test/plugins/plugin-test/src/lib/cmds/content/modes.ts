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

import { UI } from '@kui-shell/core'

import htmlTextContent from './text-html'
import plainTextContent from './text-plain'
import markdownTextContent from './text-markdown'

// string from content function
export const plainTextMode: UI.MultiModalMode[] = [{ mode: 'text', label: 'T1', content: plainTextContent }]

// string directly as content
export const plainTextModeAlt: UI.MultiModalMode[] = [{ mode: 'text2', label: 'T2', content: 'plain as day' }]

// string directly as content function string
// this should take the output of the `test string` command and place it in the mode content section
export const plainTextModeAlt2: UI.MultiModalMode[] = [
  { mode: 'text3', label: 'T3', content: 'test string', contentType: 'command' }
]

// table directly as content
export const tableMode: UI.MultiModalMode[] = [
  {
    mode: 'table',
    label: 'Tbl1',
    content: {
      body: [{ name: 'c11', attributes: [{ value: 'c12' }] }, { name: 'c21', attributes: [{ value: 'c22' }] }]
    }
  }
]

// html string
const htmlTextMode: UI.MultiModalMode[] = [
  { mode: 'html', label: 'H', content: htmlTextContent(), contentType: 'text/html' }
]

const markdownTextMode: UI.MultiModalMode[] = [
  { mode: 'm', content: markdownTextContent(), contentType: 'text/markdown' }
]

const yamlMode: UI.MultiModalMode[] = [
  {
    mode: 'yaml',
    label: 'R',
    content: 'apiVersion: this is the api version field\nkind: this is the kind field',
    contentType: 'yaml'
  }
]

export const textModes: UI.MultiModalMode[] = [].concat(
  plainTextMode,
  plainTextModeAlt,
  plainTextModeAlt2,
  tableMode,
  htmlTextMode,
  markdownTextMode,
  yamlMode
)
