/*
 * Copyright 2019-2020 IBM Corporation
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

import { isHeadless, PreloadRegistrar } from '@kui-shell/core'

export default (registrar: PreloadRegistrar) => {
  if (!isHeadless()) {
    import('./status-stripe').then(_ => _.default(registrar))

    return import('./tab-completion').then(_ => _.default())
  }
}
