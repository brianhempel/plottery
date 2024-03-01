(function() {
  "use strict";
  try {
    if (typeof document != "undefined") {
      var elementStyle = document.createElement("style");
      elementStyle.appendChild(document.createTextNode('.snp-dropdown-arrow {\n  padding: 0px 4px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border-radius: 2px;\n  cursor: pointer;\n}\n\n.snp-dropdown-arrow:hover {\n  background: #e2e2e2;\n}\n\n.snp-dropdown-arrow > svg {\n  width: 9px;\n  transform: rotate(180deg);\n  fill: #37352f;\n}\n\n.snp-dropdown:hover {\n  background: rgba(0, 0, 0, 0.07);\n}\n\n.snp-dropdown.expanded {\n  background: rgba(0, 0, 0, 0.07);\n}\n\n.snp-dropdown.expanded > .snp-dropdown-drawer {\n  display: flex;\n}\n\n\n\n/* .snp-dropdown:active > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus-within > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus-visible > .snp-dropdown-drawer {\n  display: flex;\n} */\n\n\n.snp-dropdown-drawer {\n  display: none;\n  position: absolute;\n  background: white;\n  flex-direction: column;\n\n  border: 1px solid #ababab;\n  box-shadow: 2px 2px 6px #00000026;\n  border-radius: 4px;\n  overflow: hidden;\n\n  z-index: 5;\n}\n\n.snp-dropdown {\n  position: relative;\n}\n\n.snp-dropdown-hidden-item {\n  background: white;\n  display: flex;\n  cursor: pointer;\n\n  padding: 2px 4px;\n}\n\n.snp-dropdown-hidden-item:hover {\n  background: #efefef;\n}\n\n.snp-dropdown-hidden-item.selected {\n  background: #dcdcdc;\n}\n\n.snp-dropdown-hidden-item.selected:hover {\n  background: #c9c9c9;\n}\n\n.snp-dropdown-hidden-item > div:first-child {\n  flex-grow: 1;\n}\n\n.snp-widget-id {\n  opacity: 0.4;\n  margin-left: 8px;\n  font-style: italic;\n  font-size: 0.8em;\n  font-weight: bold;\n}.snp-slider-base::before {\n  background-color: black;\n  border-radius: 1px;\n  bottom: 0;\n  content: "";\n  left: 4px;\n  opacity: .15;\n  position: absolute;\n  top: 0;\n  width: 1.5px;\n  transition: 0.1s;\n}\n\n.snp-slider-base {\n  width: 8px;\n  margin: 3px 0px 3px 0;\n  position: relative;\n  cursor: e-resize;\n}\n\n.snp-slider {\n  display: flex;\n}\n\n.snp-slider-base:hover::before {\n  opacity: 0.3;\n}\n\n.snp-slider.pressed > .snp-slider-base::before {\n  opacity: 0.5;\n  margin: 2px 0px;\n}\n\n.snp-slider-spring {\n  position: absolute;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.snp-spring-svg {\n  overflow: visible;\n}\n\n.snp-spring-svg-p1 {\n  fill: none;\n  stroke: rgba(0, 0, 0, 0.317);\n  stroke-dasharray: 2 1;\n}\n\n.snp-spring-svg-p2 {\n  fill: none;\n  stroke: rgba(0, 0, 0, 0.317);\n}\n\n.snp-slider > .snp-slider-spring > .snp-spring-svg {\n  opacity: 0;\n  pointer-events: none;\n  transform: translate(6.5px, 6px);\n  overflow: visible !important;\n}\n\n.snp-slider.pressed > .snp-slider-spring > .snp-spring-svg {\n  opacity: 1;\n  pointer-events: inherit;\n}.snp-arg-str {\n  color: #BA2121;\n}\n\n.snp-arg-number {\n  color: #080;\n}\n\n.snp-arg-operator {\n  color: #AA22FF;\n}\n/* \n.snp-arg.snp-arg-str:hover {\n  background: #ba212117;\n} */\n\n.snp-arg:focus-visible {\n  outline: none;\n}\n\n.snp-remove-arg-button {\n  content: "\\00d7";\n}\n\n.snp-call {\n  background: #F7F7F7;\n  border: 1px solid #cfcfcf;\n  border-radius: 2px;\n  margin-bottom: 4px;\n  padding: 0px 4px;\n  width: fit-content;\n  display: flex;\n  position: relative;\n  \n  padding-right: 0px;\n}\n\n.snp-call-args {\n  display: flex;\n}\n\n/* .snp-optional-arg {\n  display: flex;\n  opacity: 0;\n  overflow: hidden;\n  pointer-events: none;\n\n  max-width: 0px;\n  transition-property: max-width, opacity;\n  transition-duration: 0.4s;\n}\n\n.snp-optional-arg.expanded {\n  opacity: 0.5;\n  pointer-events: inherit;\n} */\n\n.snp-arg-optional { \n  opacity: 0;\n  max-width: 0px;\n  overflow: hidden;\n  pointer-events: none;\n  transition-property: max-width, opacity;\n  transition-duration: 0.1s;\n}\n\n.snp-call.expanded > .snp-call-args > .snp-arg-optional {\n  opacity: 0.5;\n  pointer-events: inherit;\n}\n\n.snp-call-expand-button {\n  display: flex;\n  cursor: pointer;\n  align-items: center;\n  justify-content: center;\n  margin-left: 5px;\n}\n\n.snp-call.expanded > .snp-call-expand-button {\n  /* fill: #037cf0; */\n  /* background: #deefff; */\n  background: #e5e5e5;\n}\n\n.snp-call-expand-button:hover  > svg {\n  opacity: 0.7;\n}\n\n.snp-call.expanded > .snp-call-expand-button > svg {\n  opacity: 0.6;\n}\n\n.snp-call.expanded > .snp-call-expand-button:hover > svg {\n  opacity: 1;\n}\n\n.snp-call-expand-button > svg {\n  transform: rotate(-90deg);\n  width: 20px;\n  opacity: 0.5;\n}\n\n.snp-call-args > .snp-arg-view {\n  display: flex;\n}\n\n.snp-comma-optional {\n  opacity: 0;\n  max-width: 0px;\n  overflow: hidden;\n  pointer-events: none;\n  transition-property: max-width, opacity;\n  transition-duration: 0.1s;\n}\n\n.snp-call.expanded > .snp-call-args > .snp-arg-view > .snp-comma-optional {\n  opacity: 0.5;\n  max-width: 16px;\n}.snp-method-view {\n  border-radius: 2px;\n  margin-bottom: 4px;\n  padding: 0 0 0 4px;\n  width: fit-content;\n  display: flex;\n  position: relative;\n  opacity: 0.5;\n  cursor: pointer;\n}\n\n.snp-method-view:hover {\n  background-color: rgba(0, 0, 0, 0.048);\n}.snp-artist-name {\n  width: fit-content;\n  cursor: pointer;\n  border-radius: 2px;\n  padding: 0px 2px;\n}\n\n.snp-artist-name:hover {\n  background: #00000014;\n}\n\n.snp-artist {\n  margin-bottom: 10px;\n  margin-top: 10px;\n}\n\n.snp-artist:first-child {\n  margin-top: 0px;\n}\n\n.snp-artist:last-child {\n  margin-bottom: 0px;\n}\n\n.snp-artist-header {\n  display: flex;\n  margin-bottom: 3px;\n}\n\n.snp-artist-collapse-button {\n  padding: 0px 4px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border-radius: 2px;\n  cursor: pointer;\n  padding-right: 2px;\n}\n\n.snp-artist-collapse-button:hover {\n  background: #e2e2e2;\n}\n\n.snp-artist-collapse-button > svg {\n  width: 9px;\n  transform: rotate(180deg);\n  fill: #37352f;\n}\n\n.collapsed > .snp-artist-header > .snp-artist-collapse-button > svg {\n  transform: rotate(90deg);\n  fill: #93928f;\n}\n\n.collapsed > .snp-artist-header > .snp-artist-name {\n  color: rgba(55, 53, 47, 0.5);\n}\n\n.collapsed > .snp-artist-body {\n  display: none;\n}\n\n.snp-artist-name {\n  /* font-style: italic; */\n}\n\n.snp-artist-body {\n  display: flex;\n}\n\n.snp-artist-collapse-indent {\n  width: 2px;\n  background: #e2e2e2;\n  margin-right: 10px;\n  margin-left: 7px;\n}\n\n.snp-artist-header>.snp-artist-name .snp-artist-name-faded {\n  color: #afafac;\n}\n\n/* .collapsed>.snp-artist-header>.snp-artist-name .snp-artist-name-faded {\n  opacity: 0.8;\n} */\n\n.snp-sidebar {\n  background-color: white;\n  display: flex;\n  flex-direction: column;\n  height: fit-content;\n  /* border-top: 1px solid #ababab;  */\n\n  /* border: 1px solid #ababab; */\n  /* box-shadow: 4px 4px 11px #00000026; */\n  /* border-radius: 2px; */\n\n  padding: 0px;\n\n  top: 0px;\n  left: 0px;\n\n  overflow: hidden;\n\n  font-family: monospace;\n  font-size: 14px;\n  white-space: pre;\n  margin: 10px;\n}\n\n.snp-header {\n  padding: 4px;\n  font-family: Helvetica Neue,Helvetica,Arial,sans-serif;\n  cursor: move;\n  border-top: 1px solid #ababab;\n  margin: 0px 10px;\n\n  display: none;\n}\n\n.snp-header:hover {\n  background: #cccccc;\n}\n\n.snp-artists {\n  padding: 5px 10px;\n  display: flex;\n  flex-direction: column;\n}\n\n.snp_outer {\n  align-items: center;\n}\n\n.snp_outer > svg {\n  /* display: none; */\n  max-width: 350px!important;\n  border: none !important;\n  overflow: visible;\n}\n\n.snp_outer > svg path {\n\n}\n\ng > path {\n  /* clip-path: inset(0% 0% 0% 0% round 5px); */\n  transition: 0.2s;\n  fill: #00000000;\n}\n\ng.hovered > path {\n  fill: #0000002b;\n}\n\n.snp_outer > img {\n  max-width: 350px !important;\n}\n\n.stdout_stderr {\n  font-family: monospace;\n  font-size: 14px;\n  background: #fff0d1;\n  padding: 10px;\n  margin: 20px;\n  border-radius: 5px;\n  color: #4a350a;\n  display: flex;\n  width: fit-content;\n}\n\n.stdout_stderr:empty {\n  display: none;\n}\n\n.snp_outer svg path {\n\n}\n\n/* ----------------- Code mirror styles ----------------- */\nspan.cm-variable {\n  color: #000;\n}\n\nspan.cm-number {\n  color: #080;\n}\n\nspan.cm-operator {\n  color: #AA22FF;\n  font-weight: bold;\n}\n\nspan.cm-builtin {\n  color: #008000;\n}\n\nspan.cm-string {\n  color: #BA2121;\n}'));
      document.head.appendChild(elementStyle);
    }
  } catch (e) {
    console.error("vite-plugin-css-injected-by-js", e);
  }
})();
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class AppState {
}
__publicField(AppState, "model");
__publicField(AppState, "view_model");
function get_arg_kind_from_int(arg_int) {
  const int_to_arg_kind = [
    "ARG_POS",
    // Positional argument
    "ARG_OPT",
    // Positional, optional argument (functions only, not calls)
    "ARG_STAR",
    // *arg argument
    "ARG_NAMED",
    // Keyword argument x=y in call, or keyword-only function arg
    "ARG_STAR2",
    // **arg argument
    "ARG_NAMED_OPT"
    // In an argument list, keyword-only and also optional
  ];
  return int_to_arg_kind[arg_int];
}
function arg_defaults_from_callee_type(callee) {
  return callee.arg_names.map((arg_name, arg_i) => {
    const arg_kind = get_arg_kind_from_int(callee.arg_kinds[arg_i]);
    const arg_type = callee.arg_types[arg_i];
    let arg_default_code;
    let arg_default_type;
    if (callee.definition_arguments_default_code[arg_i]) {
      arg_default_code = callee.definition_arguments_default_code[arg_i];
      arg_default_type = void 0;
    } else {
      [arg_default_code, arg_default_type] = default_code_and_code_type_for_type(arg_type, arg_name);
    }
    console.log(arg_default_type);
    return {
      name: arg_name,
      kind: arg_kind,
      code: arg_default_code,
      type: arg_type,
      code_type: arg_default_type,
      type_compatible_local_names: callee.arg_type_compatible_local_names[arg_i]
    };
  }).slice(callee.def_extras.first_arg !== void 0 ? 1 : 0);
}
function default_code_and_code_type_for_type(type, name) {
  const default_value_from_name = [
    ["width", "builtins.float", "1.0"],
    ["height", "builtins.float", "1.0"]
  ];
  const [_, __, default_code] = default_value_from_name.find(
    ([default_name, default_type, default_code2]) => name == default_name && type == default_type
  ) || [void 0, void 0, void 0];
  if (default_code !== void 0) {
    return [default_code, type];
  }
  if (type == "builtins.str") {
    return ['"Bananas..."', type];
  } else if (type == "builtins.float") {
    return ["0.5", type];
  } else if (typeof type == "object") {
    if (type[".class"] == "Instance" && type["type_ref"] == "builtins.dict") {
      return ["{}", type];
    } else if (type[".class"] == "UnionType") {
      return default_code_and_code_type_for_type(
        type.items[0],
        name
      );
    } else if (type[".class"] == "LiteralType" && type["fallback"] == "builtins.str") {
      const ltype = type;
      return [JSON.stringify(ltype.value), ltype.fallback];
    } else if ("type_ref" in type && type["type_ref"] == "matplotlib._typing.ArrayLike") {
      return ["[1,2,3]", type];
    }
  }
  return ["None", { ".class": "NoneType" }];
}
function create_el(tag, classes = [], parent) {
  const el = document.createElement(tag);
  if (Array.isArray(classes)) {
    el.classList.add(...classes);
  } else {
    el.classList.add(classes);
  }
  if (parent != void 0) {
    parent.appendChild(el);
  }
  return el;
}
function item_to_start_pos(item, cell_lineno) {
  return { line: item.pos.line - cell_lineno, ch: item.pos.column };
}
function item_to_end_pos(item, cell_lineno) {
  return { line: item.pos.end_line - cell_lineno, ch: item.pos.end_column };
}
function create_dropdown_arrow() {
  const svgContainer = create_el("div");
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.innerHTML = `<polygon points="5.9,88.2 50,11.8 94.1,88.2"></polygon>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 100 100");
  return svgContainer;
}
function create_chevron() {
  const svgContainer = create_el("div");
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.innerHTML = `<path d="M12 19a.749.749 0 0 1-.53-.22l-3.25-3.25a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215L12 17.19l2.72-2.72a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734l-3.25 3.25A.749.749 0 0 1 12 19Z"></path><path d="M12 18a.75.75 0 0 1-.75-.75v-7.5a.75.75 0 0 1 1.5 0v7.5A.75.75 0 0 1 12 18ZM2.75 6a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2.75 6Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 6.75 6Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Z"></path>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 24 24");
  svgEl.setAttribute("width", "24px");
  svgEl.setAttribute("height", "24px");
  return svgContainer;
}
function is_numeric(num) {
  return (typeof num === "number" || typeof num === "string" && num.trim() !== "") && !isNaN(num);
}
function is_array_like(val) {
  if (val.trim().at(0) == "[" && val.trim().at(-1) == "]") {
    return true;
  }
  return false;
}
function is_string_like(val) {
  const v = val.trim();
  if (v.startsWith(`"`) && v.endsWith(`"`)) {
    return true;
  } else if (v.startsWith(`'`) && v.endsWith(`'`)) {
    return true;
  } else if (v.startsWith("`") && v.endsWith("`")) {
    return true;
  }
  return false;
}
function syntax_highlight(code, container) {
  const CodeMirror = window["CodeMirror"];
  CodeMirror.runMode(
    code,
    {
      name: "python",
      version: 3,
      singleLineStringErrors: false
    },
    container
  );
}
function compare_qualified_names(name1, name2) {
  return name1.length + 100 * name1.split(".").length - (name2.length + 100 * name2.split(".").length);
}
function get_shortest_qualified_name(names) {
  return names.sort(compare_qualified_names)[0];
}
const _Ticker = class _Ticker {
  constructor() {
    // List of tick callbacks
    __publicField(this, "callbacks", {});
    __publicField(this, "time", 0);
    __publicField(this, "currID", 0);
    const timer = this;
    function tick(time) {
      const dt = time - timer.time;
      Object.values(timer.callbacks).forEach((callback) => callback(dt));
      timer.time = time;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  static _initialize() {
    if (_Ticker.instance)
      return;
    _Ticker.instance = new _Ticker();
  }
  registerTick(callback) {
    this.currID++;
    return this.registerTickFrom(callback, `Ticker_${this.currID}`);
  }
  registerTickFrom(callback, from) {
    this.callbacks[from] = callback;
    return from;
  }
  removeTickFrom(from) {
    delete this.callbacks[from];
  }
};
// Singleton
__publicField(_Ticker, "instance");
let Ticker = _Ticker;
Ticker._initialize();
function create_dropdown_widget(items) {
  const el = create_el("div", "snp-dropdown");
  const selected_item_holder_el = create_el(
    "div",
    "snp-dropdown-selected-item",
    el
  );
  const selected_item = items[0];
  selected_item_holder_el.append(selected_item.el);
  selected_item_holder_el.addEventListener("click", () => {
    el.classList.toggle("expanded");
  });
  document.body.addEventListener("click", (e) => {
    if (e.target != null && !(e.target == el) && !el.contains(e.target)) {
      if (el.classList.contains("expanded")) {
        el.classList.remove("expanded");
      }
    }
  });
  const drawer_el = create_el("div", "snp-dropdown-drawer", el);
  const selected_item_clone = get_widget_clone(selected_item);
  const sync_id = Ticker.instance.registerTick(
    sync_clone(selected_item, selected_item_clone)
  );
  const dropdown = {
    kind: WidgetKind.Dropdown,
    el,
    items: [],
    selected_item,
    selected_item_clone_el: selected_item_clone,
    sync_id,
    selected_item_holder_el,
    drawer_el
  };
  add_items_to_dropdown_widget(dropdown, items);
  return dropdown;
}
function dropdown_widget_to_code(widget) {
  return widget_to_code(widget.selected_item);
}
function add_items_to_dropdown_widget(dropdown, new_items) {
  const item_holders = [];
  for (const widget of new_items) {
    const item_holder = create_el(
      "div",
      "snp-dropdown-hidden-item",
      dropdown.drawer_el
    );
    item_holders.push([item_holder, widget]);
    if (widget == dropdown.selected_item) {
      item_holder.append(dropdown.selected_item_clone_el);
      item_holder.classList.add("selected");
    } else {
      item_holder.append(widget.el);
    }
    const id = create_el("div", "snp-widget-id", item_holder);
    id.innerHTML = get_widget_type_id(widget);
  }
  for (const [item_holder, widget] of item_holders) {
    item_holder.addEventListener("click", () => {
      dropdown.el.classList.remove("expanded");
      select_dropdown_item(dropdown, widget);
    });
  }
  dropdown.items.push(...new_items);
  dropdown.items.forEach((widget) => widget.el["tabIndex"] = 0);
}
function select_dropdown_item(dropdown, new_selected_item) {
  if (dropdown.selected_item == new_selected_item)
    return;
  dropdown.selected_item.el.remove();
  dropdown.selected_item_clone_el.insertAdjacentElement(
    "afterend",
    dropdown.selected_item.el
  );
  dropdown.selected_item_clone_el.remove();
  dropdown.selected_item.el.parentElement.classList.remove("selected");
  Ticker.instance.removeTickFrom(dropdown.sync_id);
  const selected_item_clone = get_widget_clone(new_selected_item);
  dropdown.selected_item_clone_el = selected_item_clone;
  dropdown.sync_id = Ticker.instance.registerTick(
    sync_clone(new_selected_item, selected_item_clone)
  );
  new_selected_item.el.insertAdjacentElement("afterend", selected_item_clone);
  new_selected_item.el.parentElement.classList.add("selected");
  dropdown.selected_item_holder_el.append(new_selected_item.el);
  dropdown.selected_item = new_selected_item;
}
function get_widget_clone(widget) {
  if (widget.kind == WidgetKind.Literal && widget.type == "builtins.float") {
    const clone = widget.el.cloneNode(true);
    return clone.querySelector(".snp-slider-val");
  }
  return widget.el.cloneNode(true);
}
function sync_clone(widget, clone) {
  if (widget.kind == WidgetKind.Literal && widget.type == "builtins.float") {
    return () => {
      var _a;
      if (((_a = widget.slider) == null ? void 0 : _a.val_el.innerHTML) != clone.innerHTML) {
        clone.innerHTML = widget.slider.val_el.innerHTML;
      }
    };
  }
  return () => {
    if (widget.el.innerHTML != clone.innerHTML) {
      clone.innerHTML = widget.el.innerHTML;
    }
  };
}
function create_identifier_widget(name) {
  const el = create_el("div", "snp-arg");
  el.innerText = name;
  return {
    kind: WidgetKind.Identifier,
    name,
    el
  };
}
function match_arg_code_to_identifier_widget(widget, arg_code) {
  if (widget.name == arg_code) {
    return true;
  } else {
    console.log("[Identifier] No match!", widget, arg_code);
    return false;
  }
}
function identifier_widget_to_code(widget) {
  return widget.el.innerText;
}
function get_identifier_widget_type_id(widget) {
  return "var";
}
function create_instance_widget(type) {
  const el = create_el("div", "snp-arg");
  const value = default_code_and_code_type_for_type(type)[0];
  el.innerText = value;
  el.contentEditable = "true";
  return {
    kind: WidgetKind.Instance,
    el,
    value,
    type
  };
}
function instance_widget_to_code(widget) {
  return widget.el.innerText;
}
function match_arg_code_to_instance_widget(widget, arg_code) {
  if (widget.value == arg_code) {
    return true;
  } else {
    console.log("[instance] No match!", widget, arg_code);
    return false;
  }
}
function get_instance_widget_type_id(widget) {
  if (widget.type.type_ref == "builtins.dict") {
    return "dict";
  }
  return "???";
}
function make_slider(val, min = -Infinity, max = Infinity) {
  const el = create_el("div", "snp-slider");
  const base = create_el("div", "snp-slider-base", el);
  const val_el = create_el("div", "snp-slider-val", el);
  val_el.innerText = val.toString();
  val_el.contentEditable = "true";
  let mult = 0.02;
  let pressed = false;
  let ix = 0;
  let iv = 0;
  base.addEventListener("mousedown", (e) => {
    pressed = true;
    ix = e.x;
    iv = parseFloat(val_el.innerText);
    el.classList.add("pressed");
    document.body.style.cursor = "e-resize";
  });
  document.addEventListener("mousemove", (e) => {
    if (pressed) {
      const dx = mult * (e.x - ix);
      const new_value = iv + dx;
      val_el.innerText = new_value.toFixed(2);
      e.preventDefault();
      e.stopPropagation();
    }
  });
  document.addEventListener("mouseup", (e) => {
    if (pressed) {
      pressed = false;
      el.classList.remove("pressed");
      document.body.style.cursor = "inherit";
    }
  });
  return {
    val,
    min,
    max,
    val_el,
    el,
    base
    // spring,
  };
}
function update_slider_val(widget, new_value) {
  if (widget.slider == null) {
    console.warn("No slider found!");
    return;
  }
  widget.slider.val = new_value;
  widget.slider.val_el.innerText = new_value.toString();
}
function create_literal_widget(type) {
  const el = create_el("div", "snp-arg");
  if (type == "builtins.str") {
    el.contentEditable = "true";
  }
  let slider = null;
  const default_value = default_code_and_code_type_for_type(type)[0];
  if (type == "builtins.float") {
    slider = make_slider(parseFloat(default_value));
    el.append(slider.el);
  } else {
    el.innerText = default_value;
  }
  if (type == "builtins.str" || typeof type == "object" && type.fallback == "builtins.str")
    el.classList.add("snp-arg-str");
  if (type == "builtins.float" || typeof type == "object" && type.fallback == "builtins.float")
    el.classList.add("snp-arg-number");
  return {
    kind: WidgetKind.Literal,
    el,
    type,
    slider
  };
}
function match_arg_code_to_literal_widget(widget, arg_code) {
  if (widget.type == "builtins.str" && is_string_like(arg_code)) {
    widget.el.innerText = arg_code;
    return true;
  } else if (widget.type == "builtins.float" && is_numeric(arg_code)) {
    update_slider_val(widget, parseFloat(arg_code));
    return true;
  } else if (widget.el.innerText == arg_code) {
    return true;
  } else {
    console.log("[Literal] No match!", widget, arg_code);
    return false;
  }
}
function literal_widget_to_code(widget) {
  if (widget.type == "builtins.float") {
    return widget.slider.val_el.innerText;
  } else {
    return widget.el.innerText;
  }
}
function get_literal_widget_type_id(widget) {
  if (widget.type == "builtins.str") {
    return "str";
  } else if (widget.type == "builtins.float") {
    return "num";
  } else {
    return "lit";
  }
}
var WidgetKind = /* @__PURE__ */ ((WidgetKind2) => {
  WidgetKind2["Dropdown"] = "Dropdown";
  WidgetKind2["Literal"] = "Literal";
  WidgetKind2["Alias"] = "Alias";
  WidgetKind2["Identifier"] = "Identifier";
  WidgetKind2["Instance"] = "Instance";
  return WidgetKind2;
})(WidgetKind || {});
function get_widget_type_id(widget) {
  if (widget.kind == "Alias") {
    return get_alias_widget_type_id(widget);
  } else if (widget.kind == "Identifier") {
    return get_identifier_widget_type_id();
  } else if (widget.kind == "Literal") {
    return get_literal_widget_type_id(widget);
  } else if (widget.kind == "Instance") {
    return get_instance_widget_type_id(widget);
  }
  console.warn("No implementation for matching...", widget);
  return "None";
}
function widget_to_code(widget) {
  if (widget.kind == "Alias") {
    return alias_widget_to_code(widget);
  } else if (widget.kind == "Identifier") {
    return identifier_widget_to_code(widget);
  } else if (widget.kind == "Literal") {
    return literal_widget_to_code(widget);
  } else if (widget.kind == "Instance") {
    return instance_widget_to_code(widget);
  } else if (widget.kind == "Dropdown") {
    return dropdown_widget_to_code(widget);
  }
  console.warn("No implementation for `to code`...", widget);
  return "None";
}
function create_alias_widget(a_type) {
  const el = create_el("div", ["snp-arg", "snp-arg-alias"]);
  const value = default_code_and_code_type_for_type(a_type)[0];
  el.innerText = value;
  el.contentEditable = "true";
  return {
    kind: WidgetKind.Alias,
    el,
    a_type,
    value
  };
}
function match_arg_code_to_alias_widget(widget, arg_code) {
  if (widget.a_type.type_ref == "matplotlib._typing.ArrayLike" && is_array_like(arg_code)) {
    widget.el.innerText = arg_code;
    widget.value = arg_code;
    return true;
  } else {
    console.log("[Alias] No match!", widget, arg_code);
    return false;
  }
}
function alias_widget_to_code(widget) {
  return widget.el.innerText;
}
function get_alias_widget_type_id(widget) {
  if (widget.a_type.type_ref == "matplotlib._typing.ArrayLike") {
    return "list";
  } else {
    console.log("[Alias] No match!", widget);
    return "???";
  }
}
function create_arg_view(arg, call, mark, options, add_comma = true) {
  const arg_el = create_el("div", "snp-arg-view");
  if (!options.positional) {
    const prefixEl = create_el("div", "snp-arg-name", arg_el);
    prefixEl.innerHTML = `${arg.name}<span class="snp-arg-operator">=</span>`;
  }
  if (options.optional) {
    arg_el.classList.add("snp-arg-optional");
  }
  let widget = create_arg_view_widgets(arg.type);
  widget = create_arg_view_identifier_widgets(
    widget,
    arg.type_compatible_local_names
  );
  match_arg_code_to_widget(widget, arg.code);
  arg_el.append(widget.el);
  let comma_el = null;
  if (add_comma) {
    comma_el = create_el("div", "snp-comma", arg_el);
    comma_el.innerHTML = ",&nbsp;";
  }
  return {
    el: arg_el,
    comma_el,
    widget,
    positional: options.positional,
    optional: options.optional
  };
}
function make_arg_view_non_optional(arg_view) {
  arg_view.el.classList.remove("snp-arg-optional");
  arg_view.optional = false;
}
function make_arg_view_optional(arg_view) {
  arg_view.el.classList.add("snp-arg-optional");
  arg_view.optional = true;
}
function create_arg_view_widgets(type) {
  if (typeof type == "string" || typeof type == "object" && type[".class"] == "LiteralType") {
    return create_literal_widget(type);
  } else if (typeof type == "object" && type[".class"] == "UnionType") {
    return create_arg_view_widget_union(type);
  } else if (typeof type == "object" && type[".class"] == "TypeAliasType") {
    return create_alias_widget(type);
  } else if (typeof type == "object" && type[".class"] == "Instance") {
    return create_instance_widget(type);
  }
  console.warn("No type widget implemented!", type);
  return { kind: null, el: create_el("div", "placeholder") };
}
function create_arg_view_widget_union(u_type) {
  const children = u_type.items;
  if (children.length == 1) {
    return create_arg_view_widgets(children[0]);
  }
  return create_dropdown_widget(
    children.map((type) => create_arg_view_widgets(type))
  );
}
function create_arg_view_identifier_widgets(widget, identifiers) {
  if (identifiers.length == 0)
    return widget;
  if (widget.kind != WidgetKind.Dropdown) {
    const new_widget = create_dropdown_widget([widget]);
    return create_arg_view_identifier_widgets(new_widget, identifiers);
  }
  const identifier_widgets = identifiers.map(
    (name) => create_identifier_widget(name)
  );
  add_items_to_dropdown_widget(widget, identifier_widgets);
  return widget;
}
function match_arg_code_to_widget(widget, arg_code) {
  if (widget.kind == WidgetKind.Dropdown) {
    let did_match = false;
    for (const item of widget.items) {
      const matched = match_arg_code_to_widget(item, arg_code);
      if (matched) {
        did_match = true;
        select_dropdown_item(widget, item);
        break;
      }
    }
    return did_match;
  } else if (widget.kind == WidgetKind.Alias) {
    return match_arg_code_to_alias_widget(widget, arg_code);
  } else if (widget.kind == WidgetKind.Identifier) {
    return match_arg_code_to_identifier_widget(
      widget,
      arg_code
    );
  } else if (widget.kind == WidgetKind.Literal) {
    return match_arg_code_to_literal_widget(widget, arg_code);
  } else if (widget.kind == WidgetKind.Instance) {
    return match_arg_code_to_instance_widget(
      widget,
      arg_code
    );
  }
  console.warn("No implementation for matching...", widget, arg_code);
  return false;
}
function arg_view_to_code(arg_view) {
  if (arg_view.optional == true)
    return "";
  let code = "";
  if (!arg_view.positional) {
    code += arg_view.el.children[0].innerText;
  }
  code += widget_to_code(arg_view.widget);
  code += ", ";
  return code;
}
function create_call_view(call) {
  var _a;
  const code_mirror = AppState.model.cell.code_mirror;
  const cell_lineno = AppState.model.cell_lineno;
  const mark = code_mirror.markText(
    item_to_start_pos(call.call_info.call, cell_lineno),
    item_to_end_pos(call.call_info.call, cell_lineno),
    {
      inclusiveLeft: true,
      inclusiveRight: true
    }
  );
  const call_els = create_call_view_skeleton();
  call_els.name_el.innerText = call.call_info.func_code_and_num[0];
  const {
    given_positional_args,
    given_keyword_args,
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args
  } = call;
  const arg_views = [];
  console.log(call);
  const add_args = (args, positional, optional) => {
    args.forEach((arg) => {
      const arg_view = create_arg_view(arg, call, mark, {
        positional,
        optional
      });
      call_els.args_el.append(arg_view.el);
      arg_views.push(arg_view);
    });
  };
  add_args(given_positional_args, true, false);
  add_args(needed_positional_args, true, false);
  add_args(missing_optional_positional_args, true, true);
  add_args(missing_positional_args, true, true);
  add_args(given_keyword_args, false, false);
  add_args(missing_keyword_args, false, true);
  (_a = [...call_els.args_el.querySelectorAll(".snp-comma")].at(-1)) == null ? void 0 : _a.remove();
  update_commas(arg_views);
  const expand_button_el = create_chevron();
  expand_button_el.classList.add("snp-call-expand-button");
  expand_button_el.addEventListener("click", () => {
    if (call_els.el.classList.contains("expanded")) {
      call_els.el.classList.remove("expanded");
      arg_views.forEach((arg_view) => {
        if (arg_view.optional) {
          arg_view.el.style.maxWidth = "0px";
        }
      });
    } else {
      call_els.el.classList.add("expanded");
      arg_views.forEach((arg_view) => {
        if (arg_view.optional) {
          arg_view.el.style.maxWidth = `${arg_view.el.scrollWidth}px`;
        }
      });
    }
  });
  call_els.el.append(expand_button_el);
  arg_views.forEach((arg_view) => {
    if (!arg_view.optional)
      return;
    arg_view.el.addEventListener("mousedown", (e) => {
      if (arg_view.optional) {
        make_arg_view_non_optional(arg_view);
        arg_view.el.style.maxWidth = "inherit";
        update_commas(arg_views);
      } else if (e.ctrlKey) {
        make_arg_view_optional(arg_view);
        update_commas(arg_views);
        if (!call_els.el.classList.contains("expanded")) {
          arg_view.el.style.maxWidth = "0px";
        }
      }
    });
  });
  let curr_inner_text = call_els.el.innerHTML;
  let curr_code = call_to_code(call_els.name_el.innerText, arg_views);
  Ticker.instance.registerTick(() => {
    if (curr_inner_text != call_els.el.innerText) {
      const code = call_to_code(call_els.name_el.innerText, arg_views);
      if (curr_code != code) {
        sync_call_code(mark, code);
        curr_code = code;
      }
    }
  });
  return {
    els: call_els,
    is_elided: false,
    arguments: arg_views
  };
}
function update_commas(arg_views) {
  var _a;
  arg_views.forEach((arg_view) => {
    var _a2;
    (_a2 = arg_view.comma_el) == null ? void 0 : _a2.classList.remove("snp-comma-optional");
  });
  const last_non_optional_arg_view = arg_views.findLast((arg_view) => {
    return !arg_view.optional;
  });
  (_a = last_non_optional_arg_view == null ? void 0 : last_non_optional_arg_view.comma_el) == null ? void 0 : _a.classList.add("snp-comma-optional");
}
function call_to_code(call_name, arg_views) {
  let code = `${call_name}(`;
  arg_views.forEach((arg_view) => {
    code += arg_view_to_code(arg_view);
  });
  code = code.slice(0, -2);
  code += ")";
  return code;
}
function create_call_view_skeleton() {
  const el = create_el("div", "snp-call");
  const name_el = create_el("div", "snp-call-name", el);
  const start_bracket_el = create_el("div", "snp-bracket", el);
  start_bracket_el.innerText = "(";
  const args_el = create_el("div", "snp-call-args", el);
  const end_bracket_el = create_el("div", "snp-bracket", el);
  end_bracket_el.innerText = ")";
  return {
    el,
    name_el,
    start_bracket_el,
    args_el,
    end_bracket_el
  };
}
function create_method_view(method) {
  const code_mirror = AppState.model.cell.code_mirror;
  let line_count = code_mirror.getValue().split("\n").length;
  let mark = code_mirror.markText(
    { line: line_count - 2, ch: 0 },
    { line: line_count - 2, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  );
  let required_positional_arg_codes = method.required_positional_arg.map(
    (arg) => arg.code
  );
  let required_keyword_arg_codes = method.required_keyword_args.map(
    (arg) => `${arg.name}=${arg.code}`
  );
  let new_code = `${method.receiver_name}.${method.method_info.name}(${required_positional_arg_codes.concat(required_keyword_arg_codes).join(",")})
`;
  const el = create_el("div", "snp-method-view");
  el.innerText = new_code;
  syntax_highlight(new_code, el);
  return {
    el,
    mark
  };
}
function create_artist_view(artist, sidebar_view, all_calls_and_methods) {
  let artist_name = get_shortest_qualified_name(artist.names);
  let parent_el = sidebar_view.els.artists_el;
  for (const [other_id, other_view] of Object.entries(sidebar_view.artists)) {
    const selectable_artists = AppState.model.selectable_artists;
    const other_artist = selectable_artists.find(
      (a) => a.id == parseInt(other_id)
    );
    const other_name = get_shortest_qualified_name(other_artist.names);
    if (artist_name.split(".").slice(0, -1).join(".") == other_name) {
      parent_el = other_view.els.calls_el;
      break;
    }
  }
  const artist_els = create_artist_view_skeleton();
  parent_el.append(artist_els.el);
  artist_els.collapse_button_el.addEventListener("click", () => {
    artist_els.el.classList.toggle("collapsed");
  });
  if (parent_el != sidebar_view.els.artists_el) {
    artist_els.el.classList.add("collapsed");
    const end = artist_name.split(".").at(-1);
    const rest = artist_name.split(".").slice(0, -1).join(".");
    artist_els.name_el.innerHTML = `<span class="snp-artist-name-faded">${rest}.</span>${end}`;
  } else {
    artist_els.name_el.innerHTML = `${artist_name}`;
  }
  const call_views = [];
  const calls = all_calls_and_methods[artist.id].calls;
  calls.forEach((call) => {
    if (parent_el != sidebar_view.els.artists_el) {
      const call_els = [...parent_el.querySelectorAll(".snp-call")];
      for (const call_el of call_els) {
        const prefix = call_el.querySelector(".snp-call-name").innerText;
        if (prefix == call.call_info.func_code_and_num[0]) {
          artist_els.calls_el.append(call_el);
          return;
        }
      }
    }
    const call_view = create_call_view(call);
    call_views.push(call_view);
    artist_els.calls_el.append(call_view.els.el);
  });
  const methods = all_calls_and_methods[artist.id].methods;
  methods.forEach((method) => {
    const method_prefix = `${method.receiver_name}.${method.method_info.name}`;
    if (parent_el != sidebar_view.els.artists_el) {
      const method_els = [...parent_el.querySelectorAll(".snp-method-view")];
      for (const method_el of method_els) {
        const code = method_el.innerText.replaceAll("\n", "");
        if (code.startsWith(`${method_prefix}(`)) {
          artist_els.calls_el.append(method_el);
          return;
        }
      }
    }
    for (const call of calls) {
      if (call.call_info.func_code_and_num[0] == method_prefix) {
        return;
      }
    }
    const method_view = create_method_view(method);
    artist_els.calls_el.append(method_view.el);
  });
  return {
    els: artist_els,
    is_expanded: true,
    calls: call_views,
    methods: []
  };
}
function create_artist_view_skeleton() {
  const el = create_el("div", "snp-artist");
  const header_el = create_el("div", "snp-artist-header", el);
  const collapse_button_el = create_dropdown_arrow();
  collapse_button_el.classList.add("snp-artist-collapse-button");
  header_el.append(collapse_button_el);
  const name_el = create_el("div", "snp-artist-name", header_el);
  const body_el = create_el("div", "snp-artist-body", el);
  const collapse_indent_el = create_el(
    "div",
    "snp-artist-collapse-indent",
    body_el
  );
  const calls_el = create_el("div", "snp-artist-calls", body_el);
  return {
    el,
    header_el,
    collapse_button_el,
    name_el,
    body_el,
    collapse_indent_el,
    calls_el
  };
}
function create_sidebar(all_calls_and_methods, selectable_artists) {
  const sidebar_els = create_sidebar_view_skeleton();
  const sidebar_view = {
    els: sidebar_els,
    artists: {}
  };
  selectable_artists.forEach((artist) => {
    const artist_view = create_artist_view(
      artist,
      sidebar_view,
      all_calls_and_methods
    );
    sidebar_view.artists[artist.id] = artist_view;
  });
  return sidebar_view;
}
function create_sidebar_view_skeleton() {
  const sidebar_el = create_el("div", "snp-sidebar");
  const header_el = create_el("div", "snp-header", sidebar_el);
  const artists_el = create_el("div", "snp-artists", sidebar_el);
  return {
    el: sidebar_el,
    header_el,
    artists_el
  };
}
function sync_call_code(mark, code) {
  let { from, to } = mark.find();
  const code_mirror = AppState.model.cell.code_mirror;
  code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find());
  code_mirror.setSelection(from, to);
  redraw_cell();
}
function redraw_cell() {
  const model = AppState.model;
  const view = AppState.view_model;
  const cell = model.cell;
  const codeExecuting = cell.get_text();
  const img = view.snp_outer.querySelector("img");
  if (model.busy || codeExecuting == model.last_cell_code_executed) {
    return;
  }
  model.busy = true;
  model.last_cell_code_executed = codeExecuting;
  view.stdout_stderr.innerHTML = "";
  const callbacks = cell.get_callbacks();
  callbacks.iopub.output = function(msg) {
    if (msg.header.msg_type == "execute_result" && msg.content.data["image/png"]) {
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else {
      if (msg.header.msg_type == "error") {
        view.stdout_stderr.innerText += msg.content.evalue.replaceAll(
          /\b(line +)(\d+)/gi,
          (_, line_space, n_str) => `${line_space}${parseInt(n_str) - model.provenance_is_off_by_n_lines}`
        );
      } else if (msg.header.msg_type == "stream") {
        view.stdout_stderr.innerText += msg.content.text;
      } else {
        console.log("[redraw cell]", arguments);
      }
    }
    if (codeExecuting != cell.get_text()) {
      model.busy = false;
      redraw_cell();
    } else {
      model.busy = false;
    }
  };
  cell.kernel.execute(codeExecuting, callbacks, {
    silent: false,
    store_history: true,
    stop_on_error: true
  });
}
function partition(array, predicate) {
  const trues = [];
  const falses = [];
  array.forEach((x) => {
    if (predicate(x)) {
      trues.push(x);
    } else {
      falses.push(x);
    }
  });
  return [trues, falses];
}
function takeWhile(array, predicate) {
  const out = [];
  for (const x of array) {
    if (predicate(x)) {
      out.push(x);
    } else {
      return out;
    }
  }
  return out;
}
function get_all_calls_and_methods(m) {
  let all_calls_and_methods = {};
  m.selectable_artists.forEach((artist) => {
    const artist_method_infos = m.methods.filter(
      (method) => method.show_on.includes(artist.id)
    );
    const artist_call_infos = m.calls.filter(
      (call_info) => call_info.show_on.includes(artist.id)
    );
    const artist_calls = get_calls(
      artist,
      artist_call_infos,
      m.cell_lineno,
      m.cell.code_mirror
    );
    const artist_methods = get_methods(
      artist,
      artist_method_infos,
      m.selectable_artists,
      m.cell.code_mirror
    );
    all_calls_and_methods[artist.id] = {
      calls: artist_calls,
      methods: artist_methods
    };
  });
  return all_calls_and_methods;
}
function get_methods(artist, method_infos, artists, code_mirror) {
  return method_infos.map((method_info) => {
    let receiver_name = get_shortest_qualified_name(
      artists.find((other_artist) => other_artist.id == method_info.receiver).names || [""]
    );
    let arg_defaults = arg_defaults_from_callee_type(method_info.type);
    let [required_positional_arg, required_keyword_args] = partition(
      arg_defaults.filter(
        (arg) => arg.kind == "ARG_POS" || arg.kind == "ARG_NAMED"
      ),
      (arg) => arg.kind == "ARG_POS"
    );
    return {
      method_info,
      required_positional_arg,
      required_keyword_args,
      receiver_name
    };
  });
}
function get_calls(artist, artist_call_infos, cell_lineno, code_mirror) {
  return artist_call_infos.map((call_info) => {
    const args = get_args(call_info, cell_lineno, code_mirror);
    const [given_positional_args, given_keyword_args] = partition(
      args,
      (arg) => arg.name == null
    );
    const {
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args
    } = segment_args(
      call_info.callee,
      given_positional_args,
      given_keyword_args
    );
    return {
      call_info,
      given_positional_args,
      given_keyword_args,
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args
    };
  });
}
function get_args(call_info, cell_lineno, code_mirror) {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== void 0;
  let args = [];
  call_info.given_args.forEach((given_arg, arg_i) => {
    const arg_kind = get_arg_kind_from_int(given_arg.kind);
    const arg_i_at_func_def = given_arg["name"] ? call_info.callee.arg_names.indexOf(given_arg.name) : callee_has_self_arg ? arg_i + 1 : arg_i;
    const arg_val_code = code_mirror.getRange(
      item_to_start_pos(given_arg, cell_lineno),
      item_to_end_pos(given_arg, cell_lineno)
    );
    args.push({
      name: given_arg.name,
      kind: arg_kind,
      code: arg_val_code,
      type: call_info.callee.arg_types[arg_i_at_func_def],
      code_type: void 0,
      type_compatible_local_names: call_info.callee.arg_type_compatible_local_names[arg_i_at_func_def]
    });
  });
  return args;
}
function segment_args(callee, given_positional_args, given_keyword_args) {
  const arg_defaults = arg_defaults_from_callee_type(callee);
  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    (arg) => arg.kind === "ARG_POS"
  );
  const missing_keyword_args = arg_defaults.slice(given_positional_args.length).slice(missing_positional_args.length).filter(
    (arg) => !given_keyword_args.some((given_arg) => given_arg.name === arg.name)
  ).filter((arg) => arg.kind !== "ARG_STAR2");
  let needed_positional_args = takeWhile(
    missing_positional_args,
    (arg) => arg.kind === "ARG_POS"
  );
  let missing_optional_positional_args = missing_positional_args.slice(
    needed_positional_args.length
  );
  return {
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args
  };
}
function attach_snp(snp_outer, cell_lineno, provenance_is_off_by_n_lines, user_call_info, sidebar_stuff) {
  const model = initialize_model(
    snp_outer,
    cell_lineno,
    provenance_is_off_by_n_lines,
    sidebar_stuff
  );
  AppState.model = model;
  const view = initialize_view(model, snp_outer);
  AppState.view_model = view;
  const all_calls_and_methods = get_all_calls_and_methods(model);
  view.sidebar = create_sidebar(
    all_calls_and_methods,
    model.selectable_artists
  );
  view.snp_outer.append(view.sidebar.els.el);
  view.stdout_stderr.remove();
  snp_outer.append(view.stdout_stderr);
  setTimeout(() => {
    var _a, _b, _c;
    (_c = (_b = (_a = snp_outer.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.nextElementSibling) == null ? void 0 : _c.remove();
  }, 200);
}
function initialize_model(snp_outer, cell_lineno, provenance_is_off_by_n_lines, sidebar_stuff) {
  const cell_el = snp_outer.closest(".code_cell");
  const cell = Jupyter.notebook.get_cells().filter((cell2) => cell2.element[0] === cell_el)[0];
  return {
    canvas_selection: null,
    cell,
    cell_lineno,
    last_cell_code_executed: cell.get_text(),
    provenance_is_off_by_n_lines,
    selectable_artists: sidebar_stuff.selectable_artists,
    methods: sidebar_stuff.methods,
    calls: sidebar_stuff.calls,
    busy: false
  };
}
function initialize_view(model, snp_outer) {
  const output = snp_outer.parentElement.parentElement.parentElement;
  if (output.children.length > 1) {
    output.removeChild(output.children[1]);
  }
  const stdout_stderr = snp_outer.querySelector(".stdout_stderr");
  stdout_stderr.remove();
  snp_outer.append(stdout_stderr);
  const hovered_elems = [...snp_outer.querySelectorAll("g")];
  return {
    hovered_elems,
    snp_outer,
    sidebar: void 0,
    stdout_stderr
  };
}
window["attach_snp"] = attach_snp;
