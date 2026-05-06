export type Bindings = Env;

export type AppVariables = Record<string, never>;

export type AppContext = {
  Bindings: Bindings;
  Variables: AppVariables;
};
