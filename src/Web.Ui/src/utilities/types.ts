/* OmitParam<T, Key> allows removing a property from an object parameter to a function type.
    Example usage:
    async function createRule({ rule, api }: { rule: FieldRule; api: API }): Promise<FieldRule> {}
    interface RuleService {
      create: OmitParam<typeof createRule, "api">;
    }

    RuleService.create({ rule }) // valid, api is omitted
    This is useful for creating static utility functions to call a network service,
    and also creating a nicer internal API for the service that doesn't require passing the API to every function call.
*/
// T is the function, Key is the string property name you want to drop
export type OmitParam<T extends (...args: any[]) => any, Key extends string> = T extends (args: infer Args) => infer Return
  ? Args extends Record<string, any>
    ? (args: Omit<Args, Key>) => Return
    : never
  : never;

export type RenameKey<T, OldKey extends keyof T, NewKey extends string> = Omit<T, OldKey> & {
  [K in NewKey]: T[OldKey];
};

export type RenameKeys<T, Map extends Record<keyof T & string, string>> = {
  [K in keyof T as K extends keyof Map ? Map[K] : K]: T[K];
};
