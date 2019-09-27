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
import * as assert from 'assert'

export const timeout = Math.max(5000, parseInt(process.env.TIMEOUT) || 60000)

export const waitTimeout = timeout - 5000

export const keys = {
  BACKSPACE: '\uE003',
  TAB: '\uE004',
  ENTER: '\uE007',
  DELETE: '\uE017',
  CONTROL: '\uE009',
  ESCAPE: '\uE00C'
}

/**
 * subset means that it is ok for struct1 to be a subset of struct2
 * so: every key in struct1 must be in struct2, but not vice versa
 *
 */
const sameStruct = (struct1: object, struct2: object, subset = false) => {
  if (struct1 === struct2) {
    return true
  } else if (typeof struct1 !== typeof struct2) {
    return false
  } else if (Array.isArray(struct1) && subset) {
    // array subset check has to ignore ordering within the array
    const map1 = Object.keys(struct1).reduce((M, key, idx, A) => {
      M[key] = A[idx]
      return M
    }, {})
    const map2 = Object.keys(struct2).reduce((M, key, idx, A) => {
      M[key] = A[idx]
      return M
    }, {})
    return sameStruct(map1, map2, subset)
  }

  for (const key in struct1) {
    if (!(key in struct2)) {
      console.log(`!(${key} in struct2)`)
      return false
    } else if (typeof struct1[key] === 'function') {
      // then we have a validator function
      if (!struct1[key](struct2[key])) {
        return false
      }
    } else if (typeof struct1[key] !== typeof struct2[key]) {
      console.log(`typeof struct1[${key}] !== typeof struct2[${key}] ${typeof struct1[key]} ${typeof struct2[key]}`)
      return false
    } else if (typeof struct1[key] === 'object') {
      if (!sameStruct(struct1[key], struct2[key], subset)) {
        return false
      }
    } else if (struct1[key] !== struct2[key]) {
      console.log(`struct1[${key}] !== struct2[${key}] ${struct1[key]} ${struct2[key]}`)
      return false
    }
  }

  // if struct1 if expected to be a subset of struct2, then we're done
  if (subset) return true

  for (const key in struct2) {
    if (!(key in struct1)) {
      console.log(`!(${key} in struct1)`)
      return false
    } else if (typeof struct1[key] === 'function') {
      // then we have a validator function
      if (!struct1[key](struct2[key])) {
        return false
      }
    } else if (typeof struct1[key] !== typeof struct2[key]) {
      console.log(`typeof struct1[${key}] !== typeof struct2[${key}] ${typeof struct1[key]} ${typeof struct2[key]}`)
      return false
    } else if (typeof struct2[key] === 'object') {
      if (!sameStruct(struct1[key], struct2[key], subset)) {
        return false
      }
    } else if (struct1[key] !== struct2[key]) {
      console.log(`struct1[${key}] !== struct2[${key}] ${struct1[key]} ${struct2[key]}`)
      return false
    }
  }
  return true
}

export const expectSubset = (struct1: object, failFast = true) => (str: string) => {
  try {
    const ok = sameStruct(struct1, JSON.parse(str), true)
    if (failFast) {
      assert.ok(ok)
    }
    return true
  } catch (err) {
    console.error('Error comparing subset for actual value=' + str)
    throw err
  }
}

/** is the given struct2 the same as the given struct2 (given as a string) */
export const expectStruct = (struct1: object, noParse = false, failFast = true) => (str: string) => {
  try {
    const ok = sameStruct(struct1, noParse ? str : JSON.parse(str))
    if (failFast) {
      assert.ok(ok)
    }
    return ok
  } catch (err) {
    console.error('Error comparing structs for actual value=' + str)
    throw err
  }
}

export const expectYAML = (struct1: object, subset = false, failFast = true) => (str: string) => {
  try {
    const struct2 = require('js-yaml').safeLoad(str)
    const ok = sameStruct(struct1, struct2, subset)
    if (failFast) {
      assert.ok(ok)
    }
    return ok
  } catch (err) {
    if (failFast) {
      return false
    } else {
      console.error('Error comparing subset for actual value=' + str)
      throw err
    }
  }
}

export const expectYAMLSubset = (struct1: object, failFast = true) => expectYAML(struct1, true, failFast)
