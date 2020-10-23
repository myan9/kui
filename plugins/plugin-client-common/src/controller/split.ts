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

import { Arguments, ParsedOptions, TabLayoutModificationResponse, NewSplitRequest, i18n } from '@kui-shell/core'

const strings = i18n('plugin-client-common')

type Options = NewSplitRequest['options']
type CommandLineOptions = ParsedOptions & Omit<Options, 'inverseColors'> & { inverse: boolean }

/** For debugging, this returns the tab uuid of the current split */
export function debug(args: Arguments) {
  return args.tab.uuid
}

/**
 * This plugin introduces the /split command
 *
 */
export default function split(args?: Arguments<CommandLineOptions>): TabLayoutModificationResponse<NewSplitRequest> {
  const options: Options = {
    index: args.parsedOptions.index,
    inverseColors: args.parsedOptions.inverse
  }

  return {
    apiVersion: 'kui-shell/v1',
    kind: 'TabLayoutModificationResponse',
    spec: {
      modification: 'NewSplit',
      options,
      ok: {
        content: strings(args.parsedOptions.inverse ? 'Created a split with inverted colors' : 'Created a split'),
        contentType: 'text/markdown'
      }
    }
  }
}
