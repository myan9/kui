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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-namespace */

/**
 * API: arguments to command handlers
 *
 */

import * as _Sidecar from '../sidecar'

export namespace SidecarExpect {
  export import open = _Sidecar.expectOpen
  export import openWithFailure = _Sidecar.expectOpenWithFailure
  export import fullscreen = _Sidecar.expectFullscreen
  export import closed = _Sidecar.expectClosed
  export import showing = _Sidecar.expectShowing
}
