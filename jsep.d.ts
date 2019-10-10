declare module 'jsep' {

    namespace jsep {
        export type Expression =
            | ArrayExpression
            | BinaryExpression
            | CallExpression
            | Compound
            | ConditionalExpression
            | Identifier
            | Literal
            | LogicalExpression
            | MemberExpression
            | ThisExpression
            | UnaryExpression

        export interface ArrayExpression {
            type: 'ArrayExpression';
            elements: Expression[];
        }

        export interface BinaryExpression {
            type: 'BinaryExpression';
            operator: string;
            left: Expression;
            right: Expression;
        }

        export interface CallExpression {
            type: 'CallExpression';
            arguments: Expression[];
            callee: Expression;
        }

        export interface Compound {
            type: 'Compound';
            body: Expression[];
        }

        export interface ConditionalExpression {
            type: 'ConditionalExpression';
            test: Expression;
            consequent: Expression;
            alternate: Expression;
        }

        export interface Identifier {
            type: 'Identifier';
            name: string;
        }

        export interface Literal {
            type: 'Literal';
            value: boolean | number | string;
            raw: string;
        }

        export interface LogicalExpression {
            type: 'LogicalExpression';
            operator: string;
            left: Expression;
            right: Expression;
        }

        export interface MemberExpression {
            type: 'MemberExpression';
            computed: boolean;
            object: Expression;
            property: Expression;
        }

        export interface ThisExpression {
            type: 'ThisExpression';
        }

        export interface UnaryExpression {
            type: 'UnaryExpression';
            operator: string;
            argument: Expression;
            prefix: boolean;
        }

        function addBinaryOp(operatorName: string, precedence: number): void;

        function addUnaryOp(operatorName: string): void;

        function removeBinaryOp(operatorName: string): void;

        function removeUnaryOp(operatorName: string): void;

        function removeAllUnaryOps(): void;

        const version: string;
    }

    function jsep(val: string | jsep.Expression): jsep.Expression;

    export = jsep;
}
