/* ------------------------------------------------------ */
/*                     Array Utilities                    */
/* ------------------------------------------------------ */

/* Partitions array into two based on predicate. */
export function partition<T>(array: Array<T>, predicate: (el: T) => boolean) {
  const trues: T[] = [];
  const falses: T[] = [];
  array.forEach((x) => {
    if (predicate(x)) {
      trues.push(x);
    } else {
      falses.push(x);
    }
  });
  return [trues, falses];
}

// [1,2,3].intersperse("&") => [1, '&', 2, '&', 3]
export function intersperse<T>(array: Array<T>, sep: any) {
  return array.flatMap((el, i) => (i == 0 ? [el] : [sep, el]));
}

// lol javascript can't compare arrays
export function equalByJSON(a: Object, b: Object) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function takeWhile<T>(array: Array<T>, predicate: (el: T) => boolean) {
  const out: T[] = [];
  for (const x of array) {
    if (predicate(x)) {
      out.push(x);
    } else {
      return out;
    }
  }
  return out;
}
