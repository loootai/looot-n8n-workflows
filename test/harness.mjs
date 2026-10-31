// Runs the body of an n8n Code node ("Run Once for All Items", JavaScript) outside n8n, with
// $input and $("Node name") backed by plain arrays, the way n8n exposes them.
export async function runCode(src, { input = [], nodes = {} } = {}) {
  const wrap = (items) => ({
    all: () => items.map((json) => ({ json })),
    first: () => ({ json: items[0] }),
    last: () => ({ json: items[items.length - 1] }),
    // n8n follows paired items back to the source row; the tests pass aligned arrays.
    itemMatching: (i) => ({ json: items[i] }),
  });
  const $input = wrap(input);
  const $ = (name) => {
    if (!(name in nodes)) throw new Error(`Code node referenced unknown node "${name}"`);
    return wrap(nodes[name]);
  };
  const fn = new Function("$input", "$", `return (async () => {\n${src}\n})();`);
  const out = await fn($input, $);
  if (!Array.isArray(out)) throw new Error("Code node must return an array");
  for (const item of out) if (!item || typeof item.json !== "object") throw new Error("each item needs a json object");
  return out.map((i) => i.json);
}
