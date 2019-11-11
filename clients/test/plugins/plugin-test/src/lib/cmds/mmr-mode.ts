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

/**
 * This file introduces a "test mmr mode" command that opens the sidecar with
 * some texts modes.
 *
 */

import { Commands, UI } from '@kui-shell/core'

import { metadataWithNameOnly } from './metadata'
import { textModes } from './content/modes'

export const command = 'test mmr mode'
export const modes = textModes
export const metadata = metadataWithNameOnly

export const buttons = [{ mode: 'hi', command: 'test string', kind: 'drilldown' as const }]

export const toolbarText = {
  type: 'info',
  text: 'this is the toolbar text'
}

const doModes = (): (() => UI.MultiModalResponse) => {
  return () => Object.assign(metadata, { modes, buttons, toolbarText })
}

export default (commandTree: Commands.Registrar) => {
  commandTree.listen('/test/mmr/mode', doModes(), {
    usage: {
      docs: 'A test of MultiModalResponse mode'
    }
  })
}
