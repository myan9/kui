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

import { Arguments, WithSourceReferences, flatten } from '@kui-shell/core'

import { fetch, fetchFileKustomize } from '../../lib/util/fetch-file'
import { KubeOptions, kustomizeOf, fileOfWithDetail, isTableRequest } from './options'

/**
 * @param kusto a kustomize file spec
 *
 */
interface Kustomization {
  resources?: string[]
}

/**
 * Fetch any references to --file sources, so that the views can show
 * the user what happened in more detail.
 *
 */
export default async function withSourceRefs(
  args: Arguments<KubeOptions>
): Promise<WithSourceReferences['kuiSourceRef']> {
  const { filepath, isFor } = fileOfWithDetail(args)
  const kusto = kustomizeOf(args)

  if (filepath && isTableRequest(args)) {
    try {
      const files = await fetch(args.REPL, filepath)
      console.error('withSourceRefs', files)

      const templates = files.map(({ data, filepath }) => {
        return { filepath, data: data.toString(), isFor, kind: 'source' as const, contentType: 'yaml' }
      })

      return { templates }
    } catch (err) {
      console.error('Error fetching source ref', err)
    }
  } else if (kusto) {
    const [{ safeLoad }, { join }, raw] = await Promise.all([
      import('js-yaml'),
      import('path'),
      fetchFileKustomize(args.REPL, kusto)
    ])

    const kustomization: Kustomization = safeLoad(raw.data)
    if (kustomization.resources) {
      const files = flatten(
        await Promise.all(
          kustomization.resources.map(resource => {
            return fetch(args.REPL, raw.dir ? join(raw.dir, resource) : resource)
          })
        )
      )

      const templates = files.map(({ data, filepath }) => {
        return { filepath, data: data.toString(), isFor, kind: 'source' as const, contentType: 'yaml' }
      })

      const customization = { filepath: kusto, data: raw.data.toString(), isFor: 'f' }
      console.error('customization', customization)
      return { templates, customization }
    }
  }
}
