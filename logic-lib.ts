import * as Logic from 'logic-solver'
import jsep from './jsep'

jsep.removeAllBinaryOps()
jsep.addBinaryOp(':', 1)
jsep.addBinaryOp('<==>', 1)
jsep.addBinaryOp('<==', 2)
jsep.addBinaryOp('==>', 2)
jsep.addBinaryOp('||', 3)
jsep.addBinaryOp('&&', 4)
jsep.addBinaryOp('==', 5)
jsep.addBinaryOp('!=', 5)
jsep.addBinaryOp('<', 5)
jsep.addBinaryOp('>', 5)
jsep.addBinaryOp('<=', 5)
jsep.addBinaryOp('>=', 5)
jsep.addBinaryOp('+', 6)

function evaluateExpression<A>(e: jsep.Expression, lookup: (n: string, t: string) => (...e: A[]) => A): A {
  function go(e: jsep.Expression): A {
    const ret = r => r // (console.log(e, r), r)
    // console.log(e)
    switch (e.type) {
      case 'Literal':
        return ret(lookup('literal', e.type)(e.value as any))
      case 'LogicalExpression':
        return ret(lookup(e.operator, e.type)(go(e.left), go(e.right)))
      case 'UnaryExpression':
        return ret(lookup(e.operator, e.type)(go(e.argument)))
      case 'BinaryExpression':
        return ret(lookup(e.operator, e.type)(go(e.left), go(e.right)))
      case 'CallExpression':
        return ret(lookup((e.callee as any).name, e.type)(...e.arguments.map(go)))
      case 'Identifier':
        return ret(lookup(e.name, e.type)())
      case 'Compound':
        return ret(lookup(';', e.type)(...e.body.map(go)))
      default:
        throw new Error(`Unknown expression type ${e.type} in ${JSON.stringify(e)}`)
    }
  }
  return go(e)
}

class Bit {
  public wrapped: Logic.Operand
  constructor(wrapped: Logic.Operand) {
    this.wrapped = wrapped
  }
  static wrap_fun(f: ((...xs: Logic.Operand[]) => Logic.Operand)): ((...xs: Bit[]) => Bit) {
    return (...bits) => new Bit(f(...bits.map(bit => bit.wrapped)))
  }
  static wrap_res(f: ((...xs: Logic.Bits[]) => Logic.Formula)): ((...xs: Logic.Bits[]) => Bit) {
    return (...bits) => new Bit(f(...bits))
  }
}

// const var = x => {[x]: id => Logic.variableBits(id + x, xbits, ybits)}
type Op<A, B> = (a: A, b: A) => B
type BoolOp = Op<boolean, boolean>
type RawOp = Op<string, boolean>
type BitOp = Op<Bit, Bit>
type BitsOp = Op<Logic.Bits, Logic.Bits>
const overloadBits
  : (raw_op: RawOp, bit_op: BitsOp) => RawOp | BitsOp
  = (raw_op, bit_op) => (x: any, y: any) => {
    if (x instanceof Logic.Bits) {
      return bit_op(x, y)
    } else if (typeof x === 'string') {
      return raw_op(x, y)
    } else {
      throw new Error(`${x} has type ${typeof x}, needs to be Bits or string`)
    }
  }

const overloadBit
  : (raw_op: BoolOp, bit_op: BitOp) => BoolOp | BitOp
  = (raw_op, bit_op) => (x: any, ...ys: any[]) => {
    if (x instanceof Bit) {
      return bit_op(x, ...ys)
    } else if (typeof x === 'boolean') {
      return raw_op(x, ...ys)
    } else {
      throw new Error(`${x} has type ${typeof x}, needs to be Bit or boolean`)
    }
  }

export type Arg = string | Logic.Bits | Bit | boolean
type ArgFun = ((...args: Arg[]) => Arg | void)
type DefaultFun = (name: string, ...args: Arg[]) => Arg
export type Env = Record<string, string[] | Arg | ArgFun>
  & { default?: DefaultFun }
  & { literal?: (i: number | string) => Arg }

const logic_env: Env = {
  when(b: Arg) {
    if (typeof b == 'boolean' || typeof b == 'string') {
      return !!b
    } else {
      throw new Error(`when(${b}) applied to nonboolean ${typeof b}`)
    }
  },

  '!':    overloadBit(x => !x, Bit.wrap_fun(Logic.not)),
  '||':   overloadBit((x, y) => x || y, Bit.wrap_fun(Logic.or)),
  '&&':   overloadBit((x, y) => x && y, Bit.wrap_fun(Logic.and)),
  '<==>': overloadBit((x, y) => x == y, Bit.wrap_fun(Logic.equiv)),
  '==>':  overloadBit((x, y) => !x || y, Bit.wrap_fun(Logic.implies)),
  '<==':  overloadBit((x, y) => x || !y, Bit.wrap_fun((x, y) => Logic.implies(y, x))),

  '<=':   overloadBits((x, y) => x <= y, Bit.wrap_res(Logic.lessThanOrEqual)),
  '<':    overloadBits((x, y) => x <  y, Bit.wrap_res(Logic.lessThan)),
  '>=':   overloadBits((x, y) => x >= y, Bit.wrap_res(Logic.greaterThanOrEqual)),
  '>':    overloadBits((x, y) => x >  y, Bit.wrap_res(Logic.greaterThan)),
  '==':   overloadBits((x, y) => x == y, Bit.wrap_res(Logic.equalBits)),
  '!=':   overloadBits((x, y) => x != y, Bit.wrap_res((x, y) => Logic.not(Logic.equalBits(x, y)))),

  '+':    Logic.sum,
  // half ?

  literal: (i: number | string) => typeof i == 'string' ? i : Logic.constantBits(i)
}

type Action<A> = (a: A) => void
type TemplateStringAction = Action<TemplateString>
type TemplateString = str | TemplateStringsArray

function make_executor(exec: (a: Arg) => void, init_env: Env): TemplateStringAction {
  function make_lookup(binds: Env) {
    const env = {...init_env, ...binds}
    const env_default = env.default
    return (name: string, t: string): ArgFun => {
      if (name in env) {
        if (typeof env[name] == 'function') {
          return env[name] as ArgFun
        } else {
          return () => env[name]
        }
      } else if (env_default) {
        return (...args: Arg[]) => env_default(name, ...args)
      } else {
        throw name
      }
    }
  }

  function exec_stmts(binds: Env, es: jsep.Expression[]) {
    const [e, ...rest] = es
    if (e === undefined) {
      return
    }
    if (e.type === 'BinaryExpression') {
      if (e.operator == ':') {
        const rhs = evaluateExpression<Arg>(e.right, make_lookup(binds))
        if (Array.isArray(rhs) && rhs.every(x => typeof x === 'string')) {
          rhs.forEach(x => {
            exec_stmts({...binds, [(e.left as any).name as string]: x}, rest)
          })
          return
        } else {
          throw new Error(`Right hand side ${e.right.name} of : must be an array of strings but is ${JSON.stringify(rhs)}`)
        }
      }
    }
    const res = evaluateExpression<Arg>(e, make_lookup(binds))
    if (res === false) {
      return
    }
    if (res !== true) {
      exec(res)
    }
    exec_stmts(binds, rest)
  }

  return str => {
    const e = jsep(Array.isArray(str) ? str[0] : str)
    if (e.type == 'Compound') {
      exec_stmts({}, e.body)
    } else {
      exec_stmts({}, [e])
    }
  }
}

function mapObject<K extends string, A, B>(o: Record<K, A>, f: (a: A) => B): Record<K, B> {
  return Object.fromEntries(Object.entries<A>(o).map(([k, v]) => [k, f(v)]))
}

export const init = (bitsize: (name: string) => number, init_env: Env) => {
  console.time('solver')
  const solver = new Logic.Solver()
  console.timeEnd('solver')

  const logic_var = (name0: string, ...args: Arg[]): Bit | Logic.Bits => {
    let name = name0
    if (args.some(arg => typeof arg != 'string')) {
      throw JSON.stringify({name0, args})
    }
    const flat_name = () => name + '_' + args.join('_')
    if (name.endsWith('?')) {
      name = name.slice(0, -1)
      return new Bit(flat_name())
    } else {
      return Logic.variableBits(flat_name(), bitsize(name0))
    }
  }

  const constrain = make_executor(
    (bit: Arg) => {
      if (bit instanceof Bit) {
        solver.require(bit.wrapped)
      } else {
        throw bit
      }
    },
    {
      ...logic_env,
      default: logic_var,
      ...init_env,
    } as Env)

  const minimize = (cost: TemplateString, options?: Logic.Options) => {
    const fs = [] as Logic.Operand[]
    const ws = [] as number[]
    console.time()
    console.log(typeof cost == 'string' ? cost : cost[0])
    options = options || {}
    // options.progress = console.log
    make_executor(
      (bit: Arg) => {
        if (bit instanceof Bit) {
          fs.push(bit.wrapped)
          ws.push(1)
        } else if (bit instanceof Logic.Bits) {
          bit.bits.forEach((b, i) => {
            fs.push(b)
            ws.push(Math.pow(2, i))
          })
        } else {
          throw new Error(bit)
        }
      },
      {
        ...logic_env,
        default: logic_var,
        ...init_env,
      } as Env)(cost)
    let sol = solver.solve()
    sol = sol && solver.minimizeWeightedSum(sol, fs, ws, options)
    if (sol) {
      fs.forEach(f => sol.evaluate(f) ? solver.require(f) : solver.forbid(f))
    }
    console.timeEnd()
    return sol
  }

  const sol_evaluate = sol => b => {
    if (b instanceof Logic.Bits) {
      return sol.evaluate(b)
    } else if (b instanceof Bit) {
      return sol.evaluate(b.wrapped)
    } else {
      return b
    }
  }

  const interpret = (sol: Logic.Solution, actions: Env = {}): TemplateStringAction => s => {
    const out = []
    make_executor(
      (x?) => x && out.push(sol_evaluate(sol)(x)),
      {
        ...logic_env,
        default: logic_var,
        ...init_env,
        ...mapObject(actions, f => (...args) => f(...args.map(sol_evaluate(sol)))),
      }
    )(s)
    return out.length == 1 ? out[0] : out
  }

  return {solver, constrain, interpret, minimize}
}

