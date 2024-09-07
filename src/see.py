import json
import re

html_chars_re = re.compile("[&<>\"']")

def escape_html(string):
    html_subs = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }

    return html_chars_re.sub(lambda match: html_subs[match.group(0)], string)


def json_for_attr(x):
    return escape_html(json.dumps(x))

def get_trivial_names():
    """Returns stuff like __class__, __doc__, etc."""
    return set(dir(object()))

# Generic object inspector that's waaaay better than repr()
#
# Usage: See('code')
class See():
    def __init__(self, code):
        self.obj = eval(code)
        self.code = code

    def _repr_html_(self):
        obj, code = self.obj, self.code

        field_htmls = []

        if isinstance(obj, list) or isinstance(obj, tuple):
            for i in range(len(obj)):
              try:
                field_htmls.append(self.field_to_html(i, f"[{i}]"))
              except AttributeError as e:
                  pass
        elif isinstance(obj, dict):
            for k in obj.keys():
                try:
                  field_htmls.append(self.field_to_html(repr(k), f"[{repr(k)}]"))
                except AttributeError as e:
                    pass
        else:
            trival_names = get_trivial_names()
            for name in dir(obj):
                if name not in trival_names:
                    try:
                        field_htmls.append(self.field_to_html(name, f".{name}"))
                    except AttributeError as e:
                        pass

        full_class_name = obj.__class__.__module__ + '.' + obj.__class__.__qualname__

        return """
            <div style="font-family: monospace; overflow-x: auto">
                <h3 style="color: darkblue">""" + escape_html(code) + ' (' + full_class_name + ') '+ escape_html(repr(obj)) + """</h3>
                <ul style="list-style-type: none">
                """ + "\n".join(field_htmls) + """
                </ul>
                <script>
                document.querySelectorAll("[data-click-to-open-code]").forEach(el => {
                    const code = el.dataset.clickToOpenCode;
                    el.removeAttribute("data-click-to-open-code"); // So opening a field doesn't add the event handlers again

                    el.addEventListener("click", ev => {
                        ev.stopPropagation();

                        const expanded_child = el.querySelector("div");
                        if (expanded_child) {
                            expanded_child.remove()
                        } else {
                            const callbacks = {
                                iopub: { output: function (msg) {
                                    if (
                                        msg.header.msg_type === "execute_result" &&
                                        msg.content.data["text/html"]
                                    ) {
                                        el.innerHTML += msg.content.data["text/html"]
                                        // Run the script tags
                                        el.querySelectorAll("script").forEach(script => { eval(script.innerText) });
                                    } else if (msg.header.msg_type == "error") {
                                        console.error(`[error running ${code}]`, msg.content.evalue);
                                    } else if (msg.header.msg_type == "stream") {
                                        console.error(`[error running ${code}]`, msg.content.text);
                                    } else {
                                        console.warn(`[unhandlable output message running ${code}]`, arguments);
                                    }
                                }}
                            };

                            Jupyter.notebook.kernel.execute(code, callbacks, { silent: false, store_history: false, stop_on_error: true });
                        }
                    });
                });
                </script>
            </div>
        """

    def field_to_html(self, name, accessor_code):
        val = eval(f"self.obj{accessor_code}")
        field_code = f"{self.code}{accessor_code}"
        if callable(val):
            try:
                arg_count = val.__code__.co_argcount
            except AttributeError:
                arg_count = float("inf")
            if arg_count == 1:
                field_code += "()"
                name += "()"
                val_str = "..."
            else:
                # field_code = None
                val_str = repr(val)
        else:
            val_str = repr(val)[:200]

        perhaps_click_to_open_code = f' data-click-to-open-code="See({json_for_attr(field_code)})" style="cursor: pointer"' if field_code is not None else ' style="cursor: default"'
        return f"""<li {perhaps_click_to_open_code}><span style="white-space: pre"><strong style="color: darkgreen">{name}</strong> {escape_html(val_str)}</span></li>"""
