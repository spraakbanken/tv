import {default as pretty} from "json-stringify-pretty-compact"

export function test_eval(lhs_str: any, rhs: any) {
  test_impl(lhs_str, eval(lhs_str), rhs)
}

export function test_impl(lhs_str: string, lhs: any, rhs: any) {
  const l_res = pretty(lhs)
  const r_res = pretty(rhs)
  if (l_res == r_res) {
    const style = `color: green; font-size: 1.4em; font-weight: 1000; margin-top: -1em`
    console.info(`%c\u2713%c ${lhs_str} == ${r_res}`, style, ``)
  } else {
    console.error(`${lhs_str}\n  == ${l_res}\n  != ${r_res}`)
  }
}

export interface Settable<B> {
  is: B
  set(this: this, prop: string, rhs: B): void
}
export function test<B>(fn: () => B): Settable<B>
export function test<A, B>(fn: (a: A) => B, a: A): Settable<B>
export function test<A, A2, B>(fn: (a: A, a2: A2) => B, a: A, a2: A2): Settable<B>
export function test<A, A2, A3, B>(fn: (a: A, a2: A2, a3: A3) => B, a: A, a2: A2, a3: A3): Settable<B>
export function test<A, A2, A3, A4, B>(fn: (a: A, a2: A2, a3: A3, a4: A4) => B, a: A, a2: A2, a3: A3, a4: A4): Settable<B>
export function test<B>(fn: (...a: any[]) => B, ...args: any[]): Settable<B> {
  const m = fn.toString().match(/^function\s*(\w+)/)
  const fn_name = m ? m[1] : `(${fn.toString()})`
  return Object.create(null, {
    is: {
      set(rhs) {
        test_impl(`${fn_name}(${args.map(pretty as any).join(", ")})`, fn(...args), rhs)
      }
    },
  })
}

