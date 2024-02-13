// Sort by number of dots, then by total length.
export function compare_qualified_names(name1: string, name2: string) {
  return (
    name1.length +
    100 * name1.split(".").length -
    (name2.length + +100 * name2.split(".").length)
  );
}

export function shortest_qualified_name(names: string[]) {
  return names.sort(compare_qualified_names)[0];
}
