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
import { Application } from 'spectron'
import { keys } from './util'
import { ISuite } from '../../common'
import { closed as expectClosed, open as expectedOpen } from './sidecar-expect'

/** helper method to close the sidecar */
const doClose = async function(app: Application) {
  await expectedOpen(app)
  await app.client.keys(keys.ESCAPE)
  await expectClosed(app)
}

export const close = function(ctx: ISuite) {
  it('should toggle closed the sidecar', () => doClose(ctx.app))
}
