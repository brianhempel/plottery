// Inverse of `arbitrary_to_json` in serialize.py

export function python_objects_to_js(graph_json : any) : any {
  // Deep copy is clean but unnecessary.
  let graph = JSON.parse(JSON.stringify(graph_json))

  for (let key in graph) {
    let obj = graph[key]

    // If the obj is a string, int, float, bool, or None, do nothing
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj === null) {
      continue
    }

    // If dictionary or array
    for (let key in obj) {
      if (key === '.class' || !obj.hasOwnProperty(key)) {
        continue
      }

      let child_id = obj[key]

      if (!(child_id in graph)) {
        console.error(obj)
        throw new Error(`Could not find ${child_id} in ${graph_json} for ${obj}['${key}']`)
      }
      obj[key] = graph[child_id]
    }
  }

  return graph[graph['root']]
}
