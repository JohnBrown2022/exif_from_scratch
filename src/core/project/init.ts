import { registerBuiltinNodeTypes } from './builtins';

let builtinsRegistered = false;

export function ensureBuiltinNodeTypesRegistered() {
  if (builtinsRegistered) return;
  registerBuiltinNodeTypes();
  builtinsRegistered = true;
}

