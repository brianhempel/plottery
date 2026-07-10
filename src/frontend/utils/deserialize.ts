// Inverse of `arbitrary_to_json` in serialize.py
//
// Graph format: an array where index 0 is the root object and later indices
// are other objects in discovery order. Cross-refs are integer indices into
// this array.

export function python_objects_to_js(graph_json : any) : any {
  // Deep copy is clean but unnecessary.
  let graph = JSON.parse(JSON.stringify(graph_json))

  for (let i = 0; i < graph.length; i++) {
    let obj = graph[i]

    // If the obj is a string, int, float, bool, or None, do nothing
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj === null) {
      continue
    }

    // If dictionary or array
    for (let key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue
      }

      let child_index = obj[key]

      if (typeof child_index !== 'number' || child_index < 0 || child_index >= graph.length) {
        console.error(obj)
        throw new Error(`Could not find index ${child_index} in graph for ${obj}['${key}']`)
      }
      obj[key] = graph[child_index]
    }
  }

  return graph[0]
}
