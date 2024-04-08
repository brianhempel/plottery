(function() {
  "use strict";
  try {
    if (typeof document != "undefined") {
      var elementStyle = document.createElement("style");
      elementStyle.appendChild(document.createTextNode('input.snp-arg-color {\n  width: 20px;\n  height: 20px;\n  border: none;\n  outline: none;\n  background: none;\n}.snp-dropdown-arrow {\n  padding: 0px 4px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border-radius: 2px;\n  cursor: pointer;\n}\n\n.snp-dropdown-arrow:hover {\n  background: #e2e2e2;\n}\n\n.snp-dropdown-arrow > svg {\n  width: 9px;\n  transform: rotate(180deg);\n  fill: #37352f;\n}\n\n.snp-dropdown:hover {\n  background: rgba(0, 0, 0, 0.07);\n}\n\n.snp-dropdown.expanded {\n  background: rgba(0, 0, 0, 0.07);\n}\n\n.snp-dropdown.expanded > .snp-dropdown-drawer {\n  display: flex;\n}\n\n\n\n/* .snp-dropdown:active > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus-within > .snp-dropdown-drawer {\n  display: flex;\n}\n\n.snp-dropdown:focus-visible > .snp-dropdown-drawer {\n  display: flex;\n} */\n\n\n.snp-dropdown-drawer {\n  display: none;\n  position: absolute;\n  background: white;\n  flex-direction: column;\n\n  border: 1px solid #ababab;\n  box-shadow: 2px 2px 6px #00000026;\n  border-radius: 4px;\n  overflow: hidden;\n\n  z-index: 5;\n}\n\n.snp-dropdown {\n  position: relative;\n}\n\n.snp-dropdown-hidden-item {\n  background: white;\n  display: flex;\n  cursor: pointer;\n\n  padding: 2px 4px;\n}\n\n.snp-dropdown-hidden-item:hover {\n  background: #efefef;\n}\n\n.snp-dropdown-hidden-item.selected {\n  background: #dcdcdc;\n}\n\n.snp-dropdown-hidden-item.selected:hover {\n  background: #c9c9c9;\n}\n\n.snp-dropdown-hidden-item > div:first-child {\n  flex-grow: 1;\n}\n\n.snp-widget-id {\n  opacity: 0.4;\n  margin-left: 8px;\n  font-style: italic;\n  font-size: 0.8em;\n  font-weight: bold;\n}.snp-slider-base::before {\n  background-color: black;\n  border-radius: 1px;\n  bottom: 0;\n  content: "";\n  left: 4px;\n  opacity: .15;\n  position: absolute;\n  top: 0;\n  width: 1.5px;\n  transition: 0.1s;\n}\n\n.snp-slider-base {\n  width: 8px;\n  margin: 3px 0px 3px 0;\n  position: relative;\n  cursor: e-resize;\n}\n\n.snp-slider {\n  display: flex;\n}\n\n.snp-slider-base:hover::before {\n  opacity: 0.3;\n}\n\n.snp-slider.pressed > .snp-slider-base::before {\n  opacity: 0.5;\n  margin: 2px 0px;\n}\n\n.snp-slider-spring {\n  position: absolute;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.snp-spring-svg {\n  overflow: visible;\n}\n\n.snp-spring-svg-p1 {\n  fill: none;\n  stroke: rgba(0, 0, 0, 0.317);\n  stroke-dasharray: 2 1;\n}\n\n.snp-spring-svg-p2 {\n  fill: none;\n  stroke: rgba(0, 0, 0, 0.317);\n}\n\n.snp-slider > .snp-slider-spring > .snp-spring-svg {\n  opacity: 0;\n  pointer-events: none;\n  transform: translate(6.5px, 6px);\n  overflow: visible !important;\n}\n\n.snp-slider.pressed > .snp-slider-spring > .snp-spring-svg {\n  opacity: 1;\n  pointer-events: inherit;\n}.snp-arg-str {\n  color: #BA2121;\n}\n\n.snp-arg-number {\n  color: #080;\n}\n\n.snp-arg-operator {\n  color: #AA22FF;\n}\n\n.snp-arg:focus-visible {\n  outline: none;\n}\n\n.snp-remove-arg-button {\n  content: "\\00d7";\n}\n\n.snp-arg-view {\n  display: flex;\n}\n\n.snp-arg-optional { \n  opacity: 0.5;\n  filter: saturate(0);\n}\n\n.snp-arg-view {\n  margin-bottom: 2px;\n  margin-top: 2px;\n}\n\n.snp-arg-view:first-child {\n  margin-top: 0px;\n}\n\n.snp-arg-view:last-child {\n  margin-bottom: 0px;\n}\n\n.snp-arg-name {\n  color: #2f67ac;\n  font-weight: bold;\n  margin-right: 5px;\n  min-width: 100px;\n  max-width: 100px;\n  text-overflow: ellipsis;\n  overflow: auto;\n}\n\n.snp-arg-optional > .snp-arg-name {\n  font-weight: normal;\n  color: #6a6a6a;\n}.snp-collapsable-button {\n  padding: 0px 4px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border-radius: 2px;\n  cursor: pointer;\n  padding-right: 2px;\n}\n\n.snp-collapsable-header:hover {\n  background: #e2e2e2;\n}\n\n.snp-collapsable-button > svg {\n  width: 9px;\n  transform: rotate(180deg);\n  fill: #37352f;\n  transition: 0.2s;\n}\n\n.collapsed > .snp-collapsable-header > .snp-collapsable-button > svg {\n  transform: rotate(90deg);\n  fill: #93928f;\n}\n\n.collapsed > .snp-collapsable-outer-body > .snp-collapsable-body {\n  display: none;\n}\n\n.snp-collapsable-header {\n  display: flex;\n  margin-bottom: 3px;\n\n  width: fit-content;\n  cursor: pointer;\n  user-select: none;\n  border-radius: 2px;\n}\n\n.snp-collapsable-indent {\n  margin-right: 10px;\n  margin-left: 7px;\n\n  border-right: 1px solid #cfcfcf !important;\n}\n\n.snp-collapsable-outer-body {\n  display: flex;\n}\n\n.snp-collapsable-body {\n  display: flex;\n  flex-direction: column;\n}\n\n.snp-collapsable {\n  display: flex;\n  flex-direction: column;\n}\n\n.snp-collapsable-body > div {\n  margin-bottom: 2px;\n  margin-top: 2px;\n}\n\n.snp-collapsable-body > div:last-child {\n  margin-bottom :0px;\n}\n\n.snp-collapsable-body > div:first-child {\n  margin-top: 0px;\n}\n\n.collapsed > .snp-collapsable-header {\n  margin-bottom: 0px;\n}.snp-sidebar {\n  background-color: white;\n  display: flex;\n  flex-direction: column;\n  height: fit-content;\n  /* border-top: 1px solid #ababab;  */\n\n  /* border: 1px solid #ababab; */\n  /* box-shadow: 4px 4px 11px #00000026; */\n  /* border-radius: 2px; */\n\n  padding: 0px;\n\n  top: 0px;\n  left: 0px;\n\n\n  font-family: monospace;\n  font-size: 14px;\n  white-space: pre;\n  margin: 10px;\n  z-index: 5;\n}\n\n.snp-header {\n  padding: 4px;\n  font-family: Helvetica Neue,Helvetica,Arial,sans-serif;\n  cursor: move;\n  border-top: 1px solid #ababab;\n  margin: 0px 10px;\n\n  display: none;\n}\n\n.snp-header:hover {\n  background: #cccccc;\n}\n\n.snp-artists {\n  padding: 5px 10px;\n  display: flex;\n  flex-direction: column;\n}\n\n.snp-call {\n  width: fit-content;\n  position: relative;\n}\n\n.snp-call-name {\n  /* font-style: italic; */\n  background: #6f0eff17;\n  color: #6a006a;\n  padding: 0px 4px;\n  border-radius: 2px;\n  margin-left: 2px;\n}\n\n.snp-call-name::before {\n  content: "ƒ:";\n  font-style: italic;\n  opacity: 0.5;\n  margin-right: 3px;\n}\n\n.snp-call-expand-button {\n  display: flex;\n  cursor: pointer;\n  align-items: center;\n  justify-content: center;\n  margin-left: 5px;\n}\n\n.snp-call.expanded > .snp-call-expand-button {\n  background: #e5e5e5;\n}\n\n.snp-call-expand-button:hover  > svg {\n  opacity: 0.7;\n}\n\n.snp-call.expanded > .snp-call-expand-button > svg {\n  opacity: 0.6;\n}\n\n.snp-call.expanded > .snp-call-expand-button:hover > svg {\n  opacity: 1;\n}\n\n.snp-call-expand-button > svg {\n  transform: rotate(-90deg);\n  width: 20px;\n  opacity: 0.5;\n}\n\n.snp-call.snp-focused > .snp-collapsable-header > .snp-call-name {\n  /* box-shadow: 0px 0px 0px 1px rgb(94, 196, 255); */\n  background: #bc00ff33;\n}\n\n.snp-call > .snp-collapsable-header:hover {\n  background: none;\n}\n\n.snp-call > .snp-collapsable-header:hover  > .snp-call-name {\n  background: #bc00ff33;\n}\n\n.snp-call-kwargs-label {\n  width: fit-content;\n  cursor: pointer;\n  border-radius: 2px;\n  padding: 0px 2px;\n}.snp-method-view {\n  border-radius: 2px;\n  margin-bottom: 4px;\n  padding: 0 0 0 4px;\n  width: fit-content;\n  display: flex;\n  position: relative;\n  opacity: 0.7;\n  cursor: pointer;\n  color: #6a6a6a;\n}\n\n.snp-method-view:hover {\n  background-color: rgba(0, 0, 0, 0.1);\n}\n\n.snp-method-view {\n  /* font-style: italic; */\n  background-color: rgba(0, 0, 0, 0.05);\n  color: #636363;\n  padding: 0px 4px;\n  border-radius: 2px;\n  margin-left: 2px;\n}\n\n.snp-method-view::before {\n  content: "ƒ:";\n  font-style: italic;\n  opacity: 0.5;\n  margin-right: 3px;\n}\n\n.snp-method-view.snp-focused {\n  box-shadow: 0px 0px 0px 1px rgb(94, 196, 255);\n}.snp-artist-name {\n  width: fit-content;\n  cursor: pointer;\n  border-radius: 2px;\n  padding: 0px 2px;\n}\n\n.collapsed > .snp-collapsable-header > .snp-artist-name {\n  color: rgba(55, 53, 47, 0.5);\n}\n\n.snp-trigger::before {\n  content: "ƒ:";\n  font-style: italic;\n  opacity: 0.5;\n  margin-right: 3px;\n}\n\n/* .snp-artist.snp-focused > .snp-collapsable-header > .snp-artist-name {\n  box-shadow: 0px 0px 0px 1px rgb(94, 196, 255);\n} */\n.snp-artist.snp-focused > .snp-collapsable-header {\n  background: #80808030;\n}.snp-hover-regions {\n  position: absolute;\n  top: 0px;\n  left: 0px;\n  width: 100%;\n  height: 100%;\n  max-width: 350px;\n  transition: 0.1s;\n}\n\n.snp-hover-regions:not(.disable):hover {\n  background: #ffffff94;\n}\n\n.snp-hover-region {\n  position: absolute;\n  background: rgba(0, 0, 0, 0);\n  border-radius: 5px;\n  transition: 0.2s;\n\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  flex-direction: column;\n  font-family: monospace;\n}\n\n.snp-hover-region.hovered {\n  background: rgba(0, 0, 0, 0.1);\n}\n\n/* .snp-trigger {\n  display: flex;\n  background: #ececec;\n  border: 1px solid #bababa;\n  border-radius: 4px;\n  padding: 0px 4px;\n  margin-bottom: 4px;\n  cursor: pointer;\n  color: #2e2e2e;\n} */\n\n\n/* .snp-trigger:hover {\n  background: #cccccc;\n} */\n\n.snp-trigger {\n  display: flex;\n  background: #000000b3;\n  /* border: 1px solid #bababa; */\n  border-radius: 4px;\n  padding: 0px 4px;\n  margin-bottom: 4px;\n  cursor: pointer;\n  color: #d5d5d5;\n  font-size: 11px;\n  backdrop-filter: blur(5px);\n  pointer-events: none;\n  transform: scale(0.8);\n  opacity: 0;\n  transition: 0.1s;\n}\n\n.snp-trigger:hover {\n  background: #262626;\n  color: #e7e7e7;\n}\n\n.snp-hover-regions:not(.disable):hover > .snp-hover-region > .snp-trigger {\n  pointer-events: initial;\n  transform: scale(1);\n  opacity: 1;\n}\n\n.snp-hover-region.snp-focused {\n  /* box-shadow: 0px 0px 0px 1px rgb(94, 196, 255); */\n  background: #80808030;\n}.plot-widget {\n  display: flex;\n  position: relative;\n}\n\n.plot-widget.disabled {\n  display: none !important;\n}\n\n.plot-widget-input {\n  display: none;\n  position: absolute;\n  top: -20px;\n\n  box-shadow: 0px 0px 0px 1px #0000005e, 3px 1px 5px 0px #0000003d;\n  padding: 0px 3px;\n  border-radius: 2px;\n  color: #BA2121;\n  background: #ffffff;\n  left: -10px;\n  font-size: 12px;\n\n  white-space: pre;\n}\n\n.plot-widget-container {\n  display: flex;\n  width: calc(100% + 30px) !important;\n  flex-direction: row-reverse;\n}\n\n.plot-widget-input.visible {\n  display: flex;\n\n}\n\n.plot-widget-edit-icon {\n  fill: none;\n  stroke: #000000bd;\n  stroke-width: 2px;\n  width: 15px;\n  cursor: pointer;\n}\n\n.plot-widget-edit-icon {\n  fill: none;\n  stroke: #777777bd;\n  stroke-width: 2px;\n  width: 12px;\n}\n\n.plot-widget-edit-icon:hover {\n  stroke: #5b0f88bd;\n}\n\n.plot-widget-edit-icon.toggled {\n  stroke: #5b0f88bd;\n}.snp-toggles {\n  display: flex;\n  flex-direction: column;\n  padding: 10px;\n  margin-left: 16px;\n  position: absolute;\n  right: 0px;\n  bottom: 0px;\n  opacity: 0.5;\n}\n\n.snp-toggles:hover {\n  opacity: 1;\n}\n\n.snp-toggle {\n  display: flex;\n}\n\n.snp-toggle-name {\n  margin-left: 5px;\n  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;\n  font-size: 13px;\n}\n\ninput.snp-toggle-input {\n  margin: 0px;\n}.output_subarea {\n  overflow: visible !important;\n}\n\n.snp_outer {\n  display: flex;\n  place-items: flex-start;\n}\n\n.snp_outer > svg {\n  /* display: none; */\n  max-width: 350px!important;\n  border: none !important;\n  overflow: visible;\n  margin-top: 1em !important;\n}\n\n.snp_outer > svg path {\n\n}\n\ng > path {\n  /* clip-path: inset(0% 0% 0% 0% round 5px); */\n  transition: 0.2s;\n  fill: #00000000;\n}\n\ng > path.hovered {\n  fill: #0000002b;\n}\n\n.snp_outer > img {\n  max-width: 350px !important;\n}\n\n.stdout_stderr {\n  font-family: monospace;\n  font-size: 14px;\n  background: #fff0d1;\n  padding: 10px;\n  margin: 20px;\n  border-radius: 5px;\n  color: #4a350a;\n  display: flex;\n  width: fit-content;\n}\n\n.stdout_stderr:empty {\n  display: none;\n}\n\n.snp_outer svg path {\n\n}\n\n/* ----------------- Code mirror styles ----------------- */\nspan.cm-variable {\n  color: #000;\n}\n\nspan.cm-number {\n  color: #080;\n}\n\nspan.cm-operator {\n  color: #AA22FF;\n  font-weight: bold;\n}\n\nspan.cm-builtin {\n  color: #008000;\n}\n\nspan.cm-string {\n  color: #BA2121;\n}'));
      document.head.appendChild(elementStyle);
    }
  } catch (e) {
    console.error("vite-plugin-css-injected-by-js", e);
  }
})();
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
    var _a;
    const arg_kind = get_arg_kind_from_int(callee.arg_kinds[arg_i]);
    const arg_type = callee.arg_types[arg_i];
    let arg_default_code;
    let arg_default_type;
    if (callee.definition_arguments_default_code == null) {
      console.warn("No defaults found for", callee);
    }
    if ((_a = callee.definition_arguments_default_code) == null ? void 0 : _a.at(arg_i)) {
      arg_default_code = callee.definition_arguments_default_code[arg_i];
      arg_default_type = void 0;
    } else {
      [arg_default_code, arg_default_type] = default_code_and_code_type_for_type(arg_type);
    }
    return {
      is_positional: false,
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
  if ((type == null ? void 0 : type.type_ref) == "builtins.str") {
    return ['"Bananas..."', type];
  } else if ((type == null ? void 0 : type.type_ref) == "builtins.float") {
    return ["0.5", type];
  } else if (type[".class"] == "Instance" && type["type_ref"] == "builtins.dict") {
    return ["{}", type];
  } else if (type[".class"] == "UnionType") {
    return default_code_and_code_type_for_type(
      type.items[0]
    );
  } else if (type[".class"] == "LiteralType") {
    return [JSON.stringify(type.value), type.fallback];
  } else if ("type_ref" in type && type["type_ref"] == "matplotlib._typing.ArrayLike") {
    return ["[1,2,3]", type];
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
function create_edit_icon() {
  const svgContainer = create_el("div");
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.innerHTML = `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>`;
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
function find_call_that_satisfies(pred, state) {
  for (const artist_info of state.selectable_artists) {
    const artist_view = state.sidebar.artists[artist_info.id];
    const calls = state.all_calls_and_methods[artist_info.id].calls;
    const call_views = artist_view.calls;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const call_view = call_views[i];
      if (pred(call.call_info, call_view)) {
        return { info: call.call_info, view: call_view };
      }
    }
  }
  return null;
}
function hex_to_rgb(hex) {
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}
function compare_qualified_names(name1, name2) {
  return name1.length + 100 * name1.split(".").length - (name2.length + 100 * name2.split(".").length);
}
function get_shortest_qualified_name(names) {
  return names.sort(compare_qualified_names)[0];
}
function create_color_widget(type) {
  const el = create_el("div", "snp-arg");
  const color_picker = create_el("input", "snp-arg-color");
  color_picker.setAttribute("type", "color");
  color_picker.setAttribute("value", "#e66465");
  el.append(color_picker);
  return {
    kind: WidgetKind.Color,
    type,
    el,
    color_picker
  };
}
function match_arg_code_to_color_widget(widget, arg_code) {
  return false;
}
function color_widget_to_code(widget) {
  const rgb = hex_to_rgb(widget.color_picker.value);
  return `(${(rgb.r / 255).toFixed(2)}, ${(rgb.g / 255).toFixed(2)}, ${(rgb.b / 255).toFixed(2)})`;
}
function get_color_widget_type_id(widget) {
  return "color";
}
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
  const dropdown = {
    kind: WidgetKind.Dropdown,
    el,
    items: [],
    selected_item,
    selected_item_clone_el: selected_item_clone,
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
  const selected_item_clone = get_widget_clone(new_selected_item);
  dropdown.selected_item_clone_el = selected_item_clone;
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
    return false;
  }
}
function identifier_widget_to_code(widget) {
  return widget.el.innerText;
}
function get_identifier_widget_type_id(widget) {
  return "var";
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
  if ((type == null ? void 0 : type.type_ref) == "builtins.str") {
    el.contentEditable = "true";
  }
  let slider = null;
  const default_value = default_code_and_code_type_for_type(type)[0];
  if (is_literal_type_a_kind_of(type, "builtins.float")) {
    slider = make_slider(parseFloat(default_value));
    el.append(slider.el);
  } else {
    el.innerText = default_value;
  }
  if (is_literal_type_a_kind_of(type, "builtins.str"))
    el.classList.add("snp-arg-str");
  if (is_literal_type_a_kind_of(type, "builtins.float") || is_literal_type_a_kind_of(type, "builtins.int"))
    el.classList.add("snp-arg-number");
  return {
    kind: WidgetKind.Literal,
    el,
    type,
    slider
  };
}
function is_literal_type_a_kind_of(type, kind) {
  var _a;
  if (type == kind) {
    return true;
  } else if (typeof type == "object" && (type == null ? void 0 : type[".class"]) == "Instance" && type.type_ref == kind) {
    return true;
  } else if (typeof type == "object" && (type == null ? void 0 : type[".class"]) == "LiteralType" && ((_a = type.fallback) == null ? void 0 : _a.type_ref) == kind) {
    return true;
  } else {
    return false;
  }
}
function match_arg_code_to_literal_widget(widget, arg_code) {
  if (is_literal_type_a_kind_of(widget.type, "builtins.str") && is_string_like(arg_code)) {
    widget.el.innerText = arg_code;
    return true;
  } else if (is_literal_type_a_kind_of(widget.type, "builtins.float") && is_numeric(arg_code)) {
    update_slider_val(widget, parseFloat(arg_code));
    return true;
  } else if (widget.el.innerText == arg_code) {
    return true;
  } else {
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
  } else if (widget.type == null) {
    return "None";
  } else {
    return "lit";
  }
}
var WidgetKind = /* @__PURE__ */ ((WidgetKind2) => {
  WidgetKind2["Dropdown"] = "Dropdown";
  WidgetKind2["Literal"] = "Literal";
  WidgetKind2["Alias"] = "Alias";
  WidgetKind2["Identifier"] = "Identifier";
  WidgetKind2["Color"] = "Color";
  return WidgetKind2;
})(WidgetKind || {});
function get_widget_type_id(widget) {
  if (widget.kind == "Alias") {
    return get_alias_widget_type_id(widget);
  } else if (widget.kind == "Identifier") {
    return get_identifier_widget_type_id();
  } else if (widget.kind == "Literal") {
    return get_literal_widget_type_id(widget);
  } else if (widget.kind == "Color") {
    return get_color_widget_type_id();
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
  } else if (widget.kind == "Dropdown") {
    return dropdown_widget_to_code(widget);
  } else if (widget.kind == "Color") {
    return color_widget_to_code(widget);
  }
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
    return "???";
  }
}
function create_arg_view(arg, call, mark, options) {
  const arg_el = create_el("div", "snp-arg-view");
  const prefixEl = create_el("div", "snp-arg-name", arg_el);
  prefixEl.innerHTML = `${arg.name}`;
  if (options.optional) {
    arg_el.classList.add("snp-arg-optional");
  }
  let widget = create_arg_view_widgets(arg.type);
  widget = create_arg_view_identifier_widgets(
    widget,
    arg.type_compatible_local_names ?? []
  );
  match_arg_code_to_widget(widget, arg.code);
  arg_el.append(widget.el);
  return {
    el: arg_el,
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
  if (typeof type == "object" && type[".class"] == "TypeAliasType" && type.type_ref == "matplotlib._typing.ColorType") {
    return create_color_widget(type);
  } else if (typeof type == "string" || typeof type == "object" && type[".class"] == "LiteralType" || typeof type == "object" && type[".class"] == "Instance" || typeof type == "object" && type[".class"] == "NoneType") {
    return create_literal_widget(type);
  } else if (typeof type == "object" && type[".class"] == "UnionType") {
    return create_arg_view_widget_union(type);
  } else if (typeof type == "object" && type[".class"] == "TypeAliasType") {
    return create_alias_widget(type);
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
  } else if (widget.kind == WidgetKind.Color) {
    return match_arg_code_to_color_widget();
  }
  console.warn("No implementation for matching...", widget, arg_code);
  return false;
}
function arg_view_to_code(arg, arg_view) {
  if (arg_view.optional == true)
    return "";
  let code = "";
  if (!arg_view.positional) {
    code += `${arg.name}=`;
  }
  code += widget_to_code(arg_view.widget);
  code += ", ";
  return code;
}
function create_collapsable_els() {
  const el = create_el("div", "snp-collapsable");
  const header_el = create_el("div", "snp-collapsable-header", el);
  const collapse_button_el = create_dropdown_arrow();
  collapse_button_el.classList.add("snp-collapsable-button");
  header_el.append(collapse_button_el);
  const outer_body_el = create_el("div", "snp-collapsable-outer-body", el);
  const collapse_indent_el = create_el(
    "div",
    "snp-collapsable-indent",
    outer_body_el
  );
  const body_el = create_el("div", "snp-collapsable-body", outer_body_el);
  header_el.addEventListener("click", () => {
    toggle_collapsable(el);
  });
  return {
    el,
    header_el,
    collapse_button_el,
    body_el,
    outer_body_el,
    collapse_indent_el
  };
}
function is_collapsable_collapsed(el) {
  return el.classList.contains("collapsed");
}
function collapse_collapsable(el) {
  return el.classList.add("collapsed");
}
function open_collapsable(el) {
  return el.classList.remove("collapsed");
}
function toggle_collapsable(el) {
  return el.classList.toggle("collapsed");
}
function create_sidebar(all_calls_and_methods, selectable_artists, state) {
  const sidebar_els = create_sidebar_view_skeleton();
  const sidebar_view = {
    els: sidebar_els,
    artists: {}
  };
  selectable_artists.forEach((artist) => {
    const artist_view = create_artist_view(
      artist,
      sidebar_view,
      all_calls_and_methods[artist.id],
      state
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
function find_artist_from_method(target_method_info, state) {
  for (const artist_info of state.selectable_artists) {
    const artist_view = state.sidebar.artists[artist_info.id];
    const methods = state.all_calls_and_methods[artist_info.id].methods;
    const includes = methods.map((m) => m.method_info).includes(target_method_info);
    if (includes) {
      return { info: artist_info, view: artist_view };
    }
  }
  return null;
}
function find_artist_from_call(target_call_info, state) {
  for (const artist_info of state.selectable_artists) {
    const artist_view = state.sidebar.artists[artist_info.id];
    const calls = state.all_calls_and_methods[artist_info.id].calls;
    const includes = calls.map((c) => c.call_info).includes(target_call_info);
    if (includes) {
      return { info: artist_info, view: artist_view };
    }
  }
  return null;
}
function open_collapsable_artist(target_artist, state) {
  let curr_view = target_artist.view;
  let curr_info = target_artist.info;
  while (true) {
    open_collapsable(curr_view.els.el);
    if (curr_info.parent_id == null)
      break;
    const id = curr_info.parent_id;
    curr_info = state.selectable_artists.find((artist) => artist.id == id);
    curr_view = state.sidebar.artists[id];
  }
}
function focus_on_call(target_call_info, target_call_view, state) {
  const target_artist = find_artist_from_call(target_call_info, state);
  if (target_artist == null) {
    console.warn("[Focus on call] No artist found for call.");
    return;
  }
  open_collapsable_artist(target_artist, state);
  add_temporary_focus(target_call_view.els.el);
}
function focus_on_method(target_method_info, target_method_view, state) {
  const target_artist = find_artist_from_method(target_method_info, state);
  if (target_artist == null) {
    console.warn("[Focus on call] No artist found for call.");
    return;
  }
  open_collapsable_artist(target_artist, state);
  add_temporary_focus(target_method_view.el);
}
function focus_on_call_from_code(target_code_and_loc, state) {
  const target_call = find_call_that_satisfies((call_info, _) => {
    const code_and_loc = get_code_and_loc_for_call(call_info);
    return target_code_and_loc == code_and_loc;
  }, state);
  if (target_call != null) {
    focus_on_call(target_call.info, target_call.view, state);
  }
}
function add_temporary_focus(el) {
  el.classList.add("snp-focused");
  const unfocus = () => {
    el.classList.remove("snp-focused");
    document.removeEventListener("mousedown", unfocus);
  };
  document.addEventListener("mousedown", unfocus);
}
function add_method_code(mark, code, state) {
  let { from, to } = mark.find();
  state.cell.code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find());
  const prefix = code.split("(")[0];
  const loc = to.line + state.provenance_is_off_by_n_lines + 1;
  window["snp_focused_call"] = `${prefix}${loc}`;
  hard_rerun(state);
}
function get_code_and_loc_for_call(call) {
  return `${call.func_code_and_num[0]}${call.call.pos.line}`;
}
function catalog_open_artists(state) {
  const sidebar = state.sidebar;
  const all_calls_and_methods = state.all_calls_and_methods;
  const persistent_artists = {};
  const persistent_calls = {};
  for (const artist_info of state.selectable_artists) {
    const name = get_shortest_qualified_name(artist_info.names);
    const artist_view = sidebar.artists[artist_info.id];
    persistent_artists[name] = {
      collapsed: is_collapsable_collapsed(artist_view.els.el)
    };
    const calls = all_calls_and_methods[artist_info.id].calls;
    for (let i = 0; i < artist_view.calls.length; i++) {
      const call_view = artist_view.calls[i];
      const call = calls[i];
      const code_and_loc = get_code_and_loc_for_call(call.call_info);
      persistent_calls[code_and_loc] = {
        collapsed: is_collapsable_collapsed(call_view.els.el),
        elided: false
      };
    }
  }
  window["snp_persistent_artists"] = persistent_artists;
  window["snp_persistent_calls"] = persistent_calls;
}
function hard_rerun(state) {
  state.busy = false;
  state.cell.code_mirror.getAllMarks().forEach((mark) => mark.clear());
  catalog_open_artists(state);
  state.cell.execute();
}
function sync_call_code(mark, code, state) {
  let { from, to } = mark.find();
  const code_mirror = state.cell.code_mirror;
  code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find());
  code_mirror.setSelection(from, to);
  redraw_cell(state);
}
function redraw_cell(state) {
  const cell = state.cell;
  const codeExecuting = cell.get_text();
  const img = state.snp_outer.querySelector("img");
  if (state.busy || codeExecuting == state.last_cell_code_executed) {
    return;
  }
  state.busy = true;
  state.last_cell_code_executed = codeExecuting;
  state.stdout_stderr.innerHTML = "";
  const callbacks = cell.get_callbacks();
  callbacks.iopub.output = function(msg) {
    if (msg.header.msg_type == "execute_result" && msg.content.data["image/png"]) {
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else {
      if (msg.header.msg_type == "error") {
        state.stdout_stderr.innerText += msg.content.evalue.replaceAll(
          /\b(line +)(\d+)/gi,
          (_, line_space, n_str) => `${line_space}${parseInt(n_str) - state.provenance_is_off_by_n_lines}`
        );
      } else if (msg.header.msg_type == "stream") {
        state.stdout_stderr.innerText += msg.content.text;
      } else {
        console.warn("[redraw cell]", arguments);
      }
    }
    if (codeExecuting != cell.get_text()) {
      state.busy = false;
      redraw_cell(state);
    } else {
      state.busy = false;
    }
  };
  cell.kernel.execute(codeExecuting, callbacks, {
    silent: false,
    store_history: true,
    stop_on_error: true
  });
}
function create_call_view(call, state) {
  var _a;
  const code_mirror = state.cell.code_mirror;
  const cell_lineno = state.cell_lineno;
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
  const persistent_calls = window["snp_persistent_calls"];
  const code_and_loc = get_code_and_loc_for_call(call.call_info);
  if (persistent_calls[code_and_loc]) {
    if ((_a = persistent_calls[code_and_loc]) == null ? void 0 : _a.collapsed) {
      collapse_collapsable(call_els.el);
    } else {
      open_collapsable(call_els.el);
    }
  }
  const {
    given_positional_args,
    given_keyword_args,
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs
  } = call;
  const arg_and_views = [];
  const add_args = (args, positional, optional) => {
    args.forEach((arg) => {
      const arg_view = create_arg_view(arg, call, mark, {
        positional,
        optional
      });
      call_els.body_el.append(arg_view.el);
      arg_and_views.push({ arg, view: arg_view });
    });
  };
  add_args(given_positional_args, true, false);
  add_args(needed_positional_args, true, false);
  add_args(missing_optional_positional_args, true, true);
  add_args(missing_positional_args, true, true);
  add_args(given_keyword_args, false, false);
  add_args(missing_keyword_args, false, true);
  if (kwargs != null) {
    const kwargs_collapsable = create_collapsable_els();
    kwargs_collapsable.el.classList.add("snp-kwargs");
    collapse_collapsable(kwargs_collapsable.el);
    call_els.body_el.append(kwargs_collapsable.el);
    const kwargs_label = create_el(
      "div",
      "snp-call-kwargs-label",
      kwargs_collapsable.header_el
    );
    kwargs_label.innerText = "See more";
    kwargs.forEach((arg) => {
      const arg_view = create_arg_view(arg, call, mark, {
        positional: false,
        optional: true
      });
      kwargs_collapsable.body_el.append(arg_view.el);
      arg_and_views.push({ arg, view: arg_view });
    });
  }
  arg_and_views.forEach(({ view }) => {
    if (!view.optional)
      return;
    view.el.addEventListener("mousedown", (e) => {
      if (view.optional) {
        make_arg_view_non_optional(view);
      } else if (e.ctrlKey) {
        make_arg_view_optional(view);
      }
    });
  });
  let curr_inner_text = call_els.el.innerHTML;
  let curr_code = call_to_code(call_els.name_el.innerText, arg_and_views);
  function keep_synced() {
    if (curr_inner_text != call_els.el.innerText) {
      const code = call_to_code(call_els.name_el.innerText, arg_and_views);
      if (curr_code != code) {
        sync_call_code(mark, code, state);
        curr_code = code;
      }
    }
    requestAnimationFrame(keep_synced);
  }
  keep_synced();
  return {
    els: call_els,
    is_elided: false,
    arguments: arg_and_views
  };
}
function call_to_code(call_name, arg_and_views) {
  let code = `${call_name}(`;
  arg_and_views.forEach(({ arg, view }) => {
    code += arg_view_to_code(arg, view);
  });
  code = code.slice(0, -2);
  code += ")";
  return code;
}
function create_call_view_skeleton() {
  const { el, body_el, header_el } = create_collapsable_els();
  el.classList.add("snp-call");
  const name_el = create_el("div", "snp-call-name", header_el);
  return {
    el,
    header_el,
    name_el,
    body_el
  };
}
function create_method_view(method, state) {
  const code_mirror = state.cell.code_mirror;
  let line_count = code_mirror.getValue().split("\n").length;
  let mark = code_mirror.markText(
    { line: line_count - 2, ch: 0 },
    { line: line_count - 2, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  );
  let code_prefix = `${method.receiver_name}.${method.method_info.name}`;
  const el = create_el("div", "snp-method-view");
  el.innerText = code_prefix;
  el.addEventListener("click", (_) => {
    add_method_code(mark, method.code, state);
  });
  return {
    el,
    mark
  };
}
function create_artist_view(artist, sidebar_view, calls_and_methods, state) {
  var _a;
  let artist_name = get_shortest_qualified_name(artist.names);
  let parent_el = artist.parent_id ? sidebar_view.artists[artist.parent_id].els.body_el : sidebar_view.els.artists_el;
  const { el, body_el, header_el } = create_collapsable_els();
  el.classList.add("snp-artist");
  parent_el.append(el);
  const name_el = create_el("div", "snp-artist-name", header_el);
  if (parent_el != sidebar_view.els.artists_el) {
    collapse_collapsable(el);
    const end = artist_name.split(".").at(-1);
    name_el.innerHTML = `${end}`;
  } else {
    name_el.innerHTML = `${artist_name}`;
  }
  const persistent_artists = window["snp_persistent_artists"];
  if (persistent_artists[artist_name]) {
    if ((_a = persistent_artists[artist_name]) == null ? void 0 : _a.collapsed) {
      collapse_collapsable(el);
    } else {
      open_collapsable(el);
    }
  }
  const call_views = [];
  const calls = calls_and_methods.calls;
  calls.forEach((call) => {
    const call_view = create_call_view(call, state);
    call_views.push(call_view);
    body_el.append(call_view.els.el);
  });
  const method_views = [];
  const methods = calls_and_methods.methods;
  methods.forEach((method) => {
    const method_view = create_method_view(method, state);
    method_views.push(method_view);
    body_el.append(method_view.el);
  });
  return {
    els: {
      el,
      body_el,
      header_el,
      name_el
    },
    calls: call_views,
    methods: method_views
  };
}
function set_artist_parent_ids(selectable_artists) {
  const searched = [];
  for (const artist of selectable_artists) {
    const name = get_shortest_qualified_name(artist.names);
    for (const other of searched) {
      const other_name = get_shortest_qualified_name(other.names);
      if (name.split(".").slice(0, -1).join(".") == other_name) {
        artist.parent_id = other.id;
        break;
      }
    }
    searched.push(artist);
  }
}
function make_hover_regions(state) {
  var _a, _b, _c;
  const regions = {};
  const hover_regions_el = create_el(
    "div",
    "snp-hover-regions",
    state.snp_outer
  );
  const hovered_elems = [
    ...state.snp_outer.querySelectorAll("g")
  ];
  const create_region = (artist_id, artist_view) => {
    const hovered_el = find_svg_hovered_elem(hovered_elems, artist_id);
    const h_bbox = hovered_el.getBoundingClientRect();
    const p_bbox = hover_regions_el.getBoundingClientRect();
    const top = h_bbox.top - p_bbox.top;
    const left = h_bbox.left - p_bbox.left;
    const region_el = create_el("div", "snp-hover-region", hover_regions_el);
    region_el.style.top = `${top}px`;
    region_el.style.left = `${left}px`;
    region_el.style.width = `${h_bbox.width}px`;
    region_el.style.height = `${h_bbox.height}px`;
    return { el: region_el, calls: [], methods: [], artist: artist_view };
  };
  const attach_hover_region = (region, el) => {
    el.addEventListener("mouseover", () => region.el.classList.add("hovered"));
    el.addEventListener(
      "mouseout",
      () => region.el.classList.remove("hovered")
    );
  };
  for (const artist_info of state.selectable_artists) {
    const artist_view = (_a = state.sidebar) == null ? void 0 : _a.artists[artist_info.id];
    regions[artist_info.id] = create_region(artist_info.id, artist_view);
    attach_hover_region(regions[artist_info.id], artist_view.els.header_el);
    const calls = state.all_calls_and_methods[artist_info.id].calls;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const region_artist_id = call.call_info.show_on.at(-1);
      regions[region_artist_id] = regions[region_artist_id] ?? create_region(region_artist_id);
      const call_view = (_b = state.sidebar) == null ? void 0 : _b.artists[artist_info.id].calls[i];
      regions[region_artist_id].calls.push({
        view: call_view,
        info: call.call_info
      });
      attach_hover_region(regions[region_artist_id], call_view.els.header_el);
    }
    const methods = state.all_calls_and_methods[artist_info.id].methods;
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const region_artist_id = method.method_info.show_on.at(-1);
      regions[region_artist_id] = regions[region_artist_id] ?? create_region(region_artist_id);
      const method_view = (_c = state.sidebar) == null ? void 0 : _c.artists[artist_info.id].methods[i];
      regions[region_artist_id].methods.push({
        view: method_view,
        info: method.method_info
      });
      attach_hover_region(regions[region_artist_id], method_view.el);
      add_method_trigger_to_hover_region(
        regions[region_artist_id],
        method,
        method_view,
        state
      );
    }
  }
  for (const [_, region] of Object.entries(regions)) {
    region.el.addEventListener("click", () => {
      if (window["enable_focus_from_plot"] != true) {
        return;
      }
      add_temporary_focus(region.el);
      region.calls.forEach((call) => {
        focus_on_call(call.info, call.view, state);
      });
      region.methods.forEach((method) => {
        focus_on_method(method.info, method.view, state);
      });
      if (region.artist != void 0) {
        add_temporary_focus(region.artist.els.el);
      }
    });
  }
  return { el: hover_regions_el, regions };
}
function find_svg_hovered_elem(hovered_elems, artist_id) {
  for (const el of hovered_elems) {
    const el_id = parseInt(el.getAttribute("data-artist-id"));
    if (el_id == artist_id) {
      return el;
    }
  }
  console.error("No svg hover elem found", hovered_elems, artist_id);
}
function add_method_trigger_to_hover_region(region, method, method_view, state) {
  const trigger_el = create_el("div", "snp-trigger", region.el);
  trigger_el.innerText = method_view.el.innerText;
  trigger_el.addEventListener("click", () => {
    add_method_code(method_view.mark, method.code, state);
  });
}
const plot_widgets_config = [
  {
    call_code: "ax.set_title",
    arg_name: "label",
    type: "builtins.str"
  },
  // {
  //   call_code: "ax.set_title",
  //   arg_name: "y",
  //   flip: true,
  //   type: "builtins.float",
  // },
  {
    call_code: "ax.set_xlabel",
    arg_name: "xlabel",
    type: "builtins.str"
  },
  {
    call_code: "ax.set_ylabel",
    arg_name: "ylabel",
    type: "builtins.str"
  }
];
function make_plot_widgets(state) {
  for (const plot_widget_config of plot_widgets_config) {
    let target_call = find_call_that_satisfies((call_info, _) => {
      const call_code_prefix = call_info.func_code_and_num[0];
      return call_code_prefix == plot_widget_config.call_code;
    }, state);
    if (target_call == null) {
      console.warn(
        "[Make plot widgets] Target call is null for",
        plot_widget_config
      );
      continue;
    }
    let target_arg = null;
    for (const { arg, view } of target_call.view.arguments) {
      if (arg.name == plot_widget_config.arg_name) {
        target_arg = { arg, view };
        break;
      }
    }
    if (target_arg == null) {
      console.warn(
        "[Make plot widgets] Target arg is null for",
        plot_widget_config
      );
      continue;
    }
    const hover_region = state.hover_regions.regions[target_call.info.show_on.at(-1)];
    let widget = target_arg.view.widget;
    if (widget.kind == WidgetKind.Dropdown) {
      widget = widget.selected_item;
    }
    if (hover_region.el.querySelector(".plot-widget-container") == null) {
      create_el("div", "plot-widget-container", hover_region.el);
    }
    make_plot_widget(
      plot_widget_config,
      target_call,
      target_arg,
      widget,
      hover_region
    );
  }
}
function make_plot_widget(config, call, arg, widget, hover_region, state) {
  if (widget.kind == WidgetKind.Literal && config.type == "builtins.str") {
    const container = hover_region.el.querySelector(".plot-widget-container");
    const el = create_el("div", "plot-widget", container);
    const icon = create_edit_icon();
    icon.classList.add("plot-widget-edit-icon");
    el.append(icon);
    const plot_widget_el = create_el("div", "plot-widget-input", el);
    plot_widget_el.contentEditable = "true";
    plot_widget_el.innerText = widget.el.innerText;
    icon.addEventListener("click", () => {
      plot_widget_el.classList.toggle("visible");
      icon.classList.toggle("toggled");
    });
    plot_widget_el.addEventListener("input", () => {
      widget.el.innerText = plot_widget_el.innerText;
    });
    document.addEventListener("mousedown", (e) => {
      if (plot_widget_el.classList.contains("visible") && e.target != plot_widget_el) {
        plot_widget_el.classList.remove("visible");
        icon.classList.remove("toggled");
      }
    });
  }
}
function create_toggles(state) {
  const el = create_el("div", "snp-toggles", state.sidebar.els.el);
  const method_toggle_name = "Show methods on plot";
  const method_toggle_enable = () => {
    var _a;
    (_a = state.hover_regions) == null ? void 0 : _a.el.classList.remove("disable");
  };
  const method_toggle_disable = () => {
    var _a;
    (_a = state.hover_regions) == null ? void 0 : _a.el.classList.add("disable");
  };
  const method_toggle_is_checked = window[method_toggle_name] == true;
  create_toggle(
    method_toggle_name,
    method_toggle_enable,
    method_toggle_disable,
    el,
    method_toggle_is_checked
  );
  if (!method_toggle_is_checked) {
    method_toggle_disable();
  }
  const focus_toggle_name = "Allow focus from plot";
  const focus_toggle_enable = () => {
    window["enable_focus_from_plot"] = true;
  };
  const focus_toggle_disable = () => {
    window["enable_focus_from_plot"] = false;
  };
  const focus_toggle_is_checked = window["enable_focus_from_plot"] == true;
  create_toggle(
    focus_toggle_name,
    focus_toggle_enable,
    focus_toggle_disable,
    el,
    focus_toggle_is_checked
  );
  if (focus_toggle_is_checked) {
    focus_toggle_enable();
  }
  const widget_toggle_name = "Show on-plot widgets";
  const widget_toggle_enable = () => {
    state.snp_outer.querySelectorAll(".plot-widget").forEach((w) => w.classList.remove("disabled"));
    window["snp_enable_plot_widget"] = true;
  };
  const widget_toggle_disable = () => {
    state.snp_outer.querySelectorAll(".plot-widget").forEach((w) => w.classList.add("disabled"));
    window["snp_enable_plot_widget"] = false;
  };
  const widget_toggle_is_checked = window["snp_enable_plot_widget"] == true;
  create_toggle(
    widget_toggle_name,
    widget_toggle_enable,
    widget_toggle_disable,
    el,
    widget_toggle_is_checked
  );
  if (!widget_toggle_is_checked) {
    widget_toggle_disable();
  }
}
function create_toggle(name, enable, disable, parent, checked_by_default) {
  const el = create_el("div", "snp-toggle", parent);
  const input_el = create_el(
    "input",
    "snp-toggle-input",
    el
  );
  if (checked_by_default) {
    input_el.setAttribute("checked", "");
  }
  input_el.setAttribute("type", "checkbox");
  input_el.addEventListener("change", () => {
    if (input_el.checked == true) {
      enable();
    } else {
      disable();
    }
    window[name] = input_el.checked;
  });
  const name_el = create_el("div", "snp-toggle-name", el);
  name_el.innerText = name;
  return {
    el,
    name_el,
    input_el
  };
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
function attach_snp(snp_outer, cell_lineno, provenance_is_off_by_n_lines, user_call_info, sidebar_stuff) {
  window["snp_persistent_artists"] = window["snp_persistent_artists"] ?? {};
  window["snp_persistent_calls"] = window["snp_persistent_calls"] ?? {};
  const state = initialize_state(
    snp_outer,
    cell_lineno,
    provenance_is_off_by_n_lines,
    sidebar_stuff
  );
  state.stdout_stderr.remove();
  snp_outer.append(state.stdout_stderr);
  set_artist_parent_ids(sidebar_stuff.selectable_artists);
  state.all_calls_and_methods = get_all_calls_and_methods(state);
  console.log("State", state);
  state.sidebar = create_sidebar(
    state.all_calls_and_methods,
    state.selectable_artists,
    state
  );
  state.snp_outer.append(state.sidebar.els.el);
  state.hover_regions = make_hover_regions(state);
  make_plot_widgets(state);
  create_toggles(state);
  const focused_call = window["snp_focused_call"];
  if (focused_call != null) {
    focus_on_call_from_code(focused_call, state);
    window["snp_focused_call"] = null;
  }
  setTimeout(() => {
    var _a, _b, _c;
    (_c = (_b = (_a = snp_outer.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.nextElementSibling) == null ? void 0 : _c.remove();
  }, 200);
}
function initialize_state(snp_outer, cell_lineno, provenance_is_off_by_n_lines, sidebar_stuff) {
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
    busy: false,
    snp_outer,
    sidebar: void 0,
    stdout_stderr: snp_outer.querySelector(".stdout_stderr")
  };
}
window["attach_snp"] = attach_snp;
function get_all_calls_and_methods(state) {
  let all_calls_and_methods = {};
  state.selectable_artists.forEach((artist) => {
    const artist_call_infos = state.calls.filter((call_info) => {
      return call_info.show_on.at(-1) == artist.id;
    });
    let artist_method_infos = state.methods.filter((method) => {
      return method.show_on.at(-1) == artist.id;
    });
    const artist_calls = get_calls(
      artist,
      artist_call_infos,
      state.cell_lineno,
      state.cell.code_mirror
    );
    let artist_methods = get_methods(
      artist,
      artist_method_infos,
      state.selectable_artists,
      state.cell.code_mirror
    );
    artist_methods = artist_methods.filter((method) => {
      const is_already_called = artist_calls.find(
        (call) => call.call_info.func_code_and_num[0] == `${method.receiver_name}.${method.method_info.name}`
      );
      return !(method.method_info.max_calls == 1 && is_already_called);
    });
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
    let required_positional_arg_codes = required_positional_arg.map(
      (arg) => arg.code
    );
    let required_keyword_arg_codes = required_keyword_args.map(
      (arg) => `${arg.name}=${arg.code}`
    );
    let code_prefix = `${receiver_name}.${method_info.name}`;
    let code = `${code_prefix}(${required_positional_arg_codes.concat(required_keyword_arg_codes).join(",")})
`;
    return {
      method_info,
      code,
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
      args.filter((arg) => arg.name != "kwargs"),
      (arg) => arg.is_positional
    );
    const {
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args,
      kwargs
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
      missing_optional_positional_args,
      kwargs
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
      name: call_info.callee.arg_names[arg_i_at_func_def],
      is_positional: given_arg.name == null,
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
  var _a, _b;
  let arg_defaults = arg_defaults_from_callee_type(callee);
  const kwargs_alias = arg_defaults.find((arg) => arg.name == "kwargs");
  const kwargs_items = (_b = (_a = kwargs_alias == null ? void 0 : kwargs_alias.type) == null ? void 0 : _a.resolved) == null ? void 0 : _b.items;
  const kwargs = kwargs_items ? kwargs_items.map(([name, item]) => {
    return {
      name,
      kind: "ARG_NAMED",
      code: kwargs_alias.code,
      type: item,
      code_type: kwargs_alias.code_type,
      type_compatible_local_names: [],
      is_positional: false
    };
  }) : null;
  arg_defaults = arg_defaults.filter((arg) => arg.name != "kwargs");
  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    (arg) => arg.kind === "ARG_POS"
  );
  const missing_keyword_args = arg_defaults.slice(given_positional_args.length).slice(missing_positional_args.length).filter(
    (arg) => !given_keyword_args.some((given_arg) => given_arg.name === arg.name)
  );
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
    missing_optional_positional_args,
    kwargs
  };
}
