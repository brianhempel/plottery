export enum WidgetKind {
  Dropdown = "Dropdown",
  Literal = "Literal",
  Alias = "Alias",
  Identifier = "Identifier",
  Instance = "Instance",
}

export type Widget = {
  kind: WidgetKind;
  el: HTMLElement;
};
