
// lol javascript can't compare stuff
export function equalByJSON(a: Object, b: Object) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ------------------------------------------------------ */
/*                     Array Utilities                    */
/* ------------------------------------------------------ */

declare global {
  interface Array<T> {
    partition(predicate: (el: T) => boolean) : [T[], T[]];
    intersperse<U>(sep: U): (T | U)[];
    clean(): Exclude<T, null | undefined>[];
    takeWhile(predicate: (el: T) => boolean): T[];
    filterMap<U>(callback: (value: T, index: number, array: T[]) => U | null | undefined): U[];
  }
}


/* Partitions array into two based on predicate. */
if (!Array.prototype.partition) {
  Array.prototype.partition = function<T>(this: T[], predicate: (el: T) => boolean): [T[], T[]] {
    const trues: T[] = [];
    const falses: T[] = [];
    this.forEach((x) => {
      if (predicate(x)) {
        trues.push(x);
      } else {
        falses.push(x);
      }
    });
    return [trues, falses];
  };
}

// [1,2,3].intersperse("&") => [1, '&', 2, '&', 3]
if (!Array.prototype.intersperse) {
  Array.prototype.intersperse = function<T, U>(this: Array<T>, sep: U): (T | U)[] {
    return this.flatMap((el, i) => (i == 0 ? [el] : [sep, el]));
  }
}

if (!Array.prototype.takeWhile) {
  Array.prototype.takeWhile = function<T>(this: Array<T>, predicate: (el: T) => boolean) {
    const out: T[] = [];
    for (const x of this) {
      if (predicate(x)) {
        out.push(x);
      } else {
        return out;
      }
    }
    return out;
  }
}

// remove null and undefined from array
if (!Array.prototype.clean) {
  Array.prototype.clean = function<T>(this: (T | null | undefined)[]): T[] {
    return this.filter(item => item !== null && item !== undefined) as T[];
  };
}

// remove null and undefined from array after mapping
if (!Array.prototype.filterMap) {
  Array.prototype.filterMap = function<T, U>(this: T[], callback: (value: T, index: number, array: T[]) => U | null | undefined): U[] {
    return this.map(callback).clean();
  };
}
