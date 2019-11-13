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
 * This file tests "test mmr mode-via-registration" command that opens the sidecar with
 * pre-registred mode and badges.
 *
 * See the command implementation in: plugin-test/src/lib/cmds/mmr-mode-via-registration.ts
 *
 */
import { TestMMR, ExpectMode } from '@kui-shell/test'

import { metadata as _meta } from '../../lib/cmds/mmr-mode-via-registration'
import { badgesWeWillRegister as badges } from '../../lib/modes'

const { metadata } = _meta

const test = new TestMMR({
  testName: 'mmr-mode-via-registration',
  metadata,
  command: 'test mmr mode-via-registration'
})

const expectModes: ExpectMode[] = [
  { mode: 'mode1', content: 'yo: this is mode1', contentType: 'text/plain' },
  { mode: 'mode2', content: 'this is mode2', contentType: 'text/plain' },
  { mode: 'mode3', label: 'mode3 label', contentType: 'text/markdown' }
]

test.badges(badges)
test.modes(expectModes, { testWindowButtons: true })
