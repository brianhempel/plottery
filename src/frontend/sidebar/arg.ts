export function make_arg_el(arg: Arg, options = { positional: false }) {
  const arg_el = createElement("span");

  if (arg.kind !== "ARG_POS") {
    // Make remove button
    const remove_button = createElement("span");
    remove_button.innerText = "❌";
    remove_button.style.fontSize = "0.5em";
    remove_button.style.verticalAlign = "super";
    remove_button.style.cursor = "pointer";
    remove_button.title = `Remove argument \`${arg.name}\``;

    remove_button.addEventListener("click", (ev) => {
      const ellipses_el = siblingsAfter(arg_el).find(
        (node) => node.hidden_arg_els !== undefined
      );
      // Try to remove the extra comma.
      // Need to skip any ellipses elements.
      const node_before = siblingsBefore(arg_el).find(
        (node) => to_code(node) !== "" && !node.textContent.match(/^\s*$/)
      );
      const node_after = siblingsAfter(arg_el).find(
        (node) => to_code(node) !== "" && !node.textContent.match(/^\s*$/)
      );
      if (node_before?.textContent?.match(/\s*,\s*$/)) {
        node_before.textContent = node_before.textContent.replace(
          /\s*,\s*$/,
          ""
        );
      } else if (node_after?.textContent?.match(/^\s*,\s*/)) {
        node_after.textContent = node_before.textContent.replace(
          /^\s*,\s*/,
          ""
        );
      }
      arg_el.remove();
      if (ellipses_el) {
        ellipses_el.hidden_arg_els.push(arg_el);
        ellipses_el.style.display = "inline";
      }
      sync_editor_and_output();
    });
    arg_el.append(remove_button);
  }

  if (options?.positional) {
    arg_el.append(
      arg_to_widget(
        sync_editor_and_output,
        arg.code,
        arg.type,
        arg.code_type,
        arg.type_compatible_local_names
      )
    );
  } else {
    arg_el.append(
      arg.name,
      "=",
      arg_to_widget(
        sync_editor_and_output,
        arg.code,
        arg.type,
        arg.code_type,
        arg.type_compatible_local_names
      )
    );
  }
  return arg_el;
}
