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

import {
  eventBus,
  expandHomeDir,
  CommandStartEvent,
  KResponse,
  ParsedOptions,
  Registrar,
  StatusStripeChangeEvent,
  getPrimaryTabId
} from '@kui-shell/core'

/** For the Kui command registration: enforce one mandatory positional parameter */
const required = [{ name: '<filepath>', docs: 'path to saved snapshot' }]

/** Usage for the replay command */
const replayUsage = {
  usage: {
    strict: 'replay',
    required,
    optional: [
      { name: '--freshen', alias: '-f', boolean: true, docs: 'Regenerate snapshot' },
      { name: '--new-window', alias: '-w', boolean: true, docs: 'Replay in a new window (Electron only)' },
      { name: '--new-tab', alias: '-t', boolean: true, docs: 'Replay in a tab' },
      { name: '--status-stripe', docs: 'Modify status stripe', allowed: ['default', 'blue', 'yellow', 'red'] }
    ]
  },
  flags: {
    boolean: ['new-window', 'w', 'new-tab', 't', 'freshen', 'f']
  }
}

/** Usage for the snapshot command */
const snapshotUsage = {
  usage: {
    strict: 'snapshot',
    required,
    optional: [
      { name: '--shallow', alias: '-s', boolean: true, docs: 'Do not record click events' },
      { name: '--description', alias: '-d', docs: 'Description for this snapshot' },
      { name: '--exec', alias: '-x', docs: 'Prefer to re-execute commands when replay' },
      { name: '--title', alias: '-t', docs: 'Title for this snapshot' }
    ]
  },
  flags: {
    boolean: ['--shallow', '-s']
  }
}

interface ReplayOptions extends ParsedOptions {
  'new-tab': boolean
  'new-window': boolean
  'status-stripe': StatusStripeChangeEvent['type']
}

interface SnapshotOptions extends ParsedOptions {
  s?: boolean
  shallow?: boolean
  d?: string
  description?: string
  t?: string
  title?: string
  exec?: boolean
  x?: boolean
}

/** Command registration */
export default function(registrar: Registrar) {
  // register the `replay` command
  registrar.listen<KResponse, ReplayOptions>(
    '/replay',
    async ({ argvNoOptions, parsedOptions, REPL }) => {
      const filepath = expandHomeDir(argvNoOptions[1])
      return REPL.qexec(
        `tab new -f "${filepath}" --quiet --status-stripe-type ${parsedOptions['status-stripe'] || 'blue'}`,
        undefined,
        undefined
      )
    },
    replayUsage
  )

  // register the `snapshot` command
  registrar.listen<KResponse, SnapshotOptions>(
    '/snapshot',
    ({ argvNoOptions, parsedOptions, REPL, tab }) =>
      new Promise((resolve, reject) => {
        // debounce block callbacks
        const seenExecUUIDs: Record<string, boolean> = {}

        const ourMainTab = getPrimaryTabId(tab)
        eventBus.emitSnapshotRequest({
          filter: (evt: CommandStartEvent) => {
            if (
              !/^kui-freshen/.test(evt.command) &&
              getPrimaryTabId(evt.tab) === ourMainTab &&
              !seenExecUUIDs[evt.execUUID]
            ) {
              seenExecUUIDs[evt.execUUID] = true
              return true
            }
          },
          cb: async (data: Buffer) => {
            try {
              const filepath = expandHomeDir(argvNoOptions[argvNoOptions.indexOf('snapshot') + 1])
              await REPL.rexec<{ data: string }>(`fwrite ${REPL.encodeComponent(filepath)}`, {
                data: Buffer.from(data).toString()
              })
              resolve(true)
            } catch (err) {
              reject(err)
            }
          },
          opts: {
            title: parsedOptions.t || parsedOptions.title,
            description: parsedOptions.d || parsedOptions.description,
            preferReExecute: parsedOptions.exec || parsedOptions.x,
            shallow: parsedOptions.shallow
          }
        })
      }),
    snapshotUsage
  )
}
