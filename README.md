# Install instructions

### Setup Python packages.

Create a virtual environment (recommended).

```
python3 -m venv .venv
source .venv/bin/activate
```

Install Python packages.

```
pip install -r requirements.txt
```
  
Install node packages.

```
npm install
```

Install and enable `nbextension`, and build `snp.ts`.

```
npm run build
```


Test it by opening jupyter and running `src/snp.ipynb`.

```
jupyter notebook
```

  
# TODO

## Framing

1. It's a GUI for matplotlib that integrates with the regular code, rather than being a code generator.
	2. Easier than LLMs?
	3. This contribution is valuable because (1) how awful matplotlib is, and (b) how many people use it.
2. Taking the types and using it to generate GUIs. We are really leveraging type annotations to build GUIs. How does that connect to the visual part? We can only have visual and hierarchy for matplotlib. Then, we have to make it for another system?
	1. Pandas dataframe editors aren't good (they aren't even editors...)
	2. If we wanted to do something only around types...can we do something around another library?

## Corpus

- Can start with asking people who make plots, for their recent plots (to collect a corpus).
	- Dev: This is cool, I like the motivation behind it, but it feels like a wasted opportunity to encounter these people and their plots and only takeaway a small corpus of plots.
- What coverage do we have over `matplotlib`?

## Implementation

- Better way to invoke SNP rather than injecting a Python file and calling a function in it.
	- `src/` is a combination of distribution and source and the example ipynb.
	    - I can't separate them out because the ipynb executes the python file in-place, so their paths need to be the same.
	    - Ideally, the nbextension would route execution but it doesn't.
	    - We can maybe instead execute the Python through the extension beforehand
	    ([Example of importing Python code from nbextension's js](https://github.com/ipython-contrib/jupyter_contrib_nbextensions/blob/374defd124b636e3337ef8e6249f3c67da6982b8/src/jupyter_contrib_nbextensions/nbextensions/varInspector/main.js#L210))
- Provide a hierarchy to the artists from the Python (`artist.ts > create_artist_view`)
- A real structured editor.
	- Some consequences of having widgets that almost feel like an editor:
		- Currently, there are `widgets` which are specific editors for a type. E.g. a `LiteralWidget` gives a text editor (if literal is a string) or a slider (if literal is a number). If the user types in a number into the text editor, or a variable name, the system does not know that the types have been switched.
		- There is no composition of widgets. If a list has numbers, the numbers will not be invokable by sliders.
		- A `list` is a freeform input rather than a widget.
		- A `dict` is a freeform input rather than a widget.
- Show variable as editors, just like method calls are shown.
	- For example, 
		- `ax.bar`
			- ``ax.bar(counts, colors)`
			  ...
			- `counts`
				- `[1,2,3,4]`
- What types other than `matplotlib._typing.ArrayLike` can an `Alias` type be? (`alias.ts > match_arg_code_to_alias_widget`)
- What types other than `matplotlib._typing.ArrayLike` can an `InstanceType` type be? (`instance.ts > get_instance_widget_type_id`)
- Handle dropdowns for empty union types, is this every going to be a case? (`dropdown.ts > create_dropdown_widget`)
- Why does `["width", "builtins.float", "1.0"]` have a hardcoded type and default? Isn't this something we should infer from type stubs?
- Can I get the type for `fontdict` beyond it being a dictionary? (is this a limitation of the type stubs or `mypy`?)
- ```python
	/tmp/ipykernel_1719349/1323490357.py:6: RuntimeWarning: More than 20 figures have been opened. Figures created through the pyplot interface (`matplotlib.pyplot.figure`) are retained until explicitly closed and may consume too much memory. (To control this warning, see the rcParam `figure.max_open_warning`). Consider using `matplotlib.pyplot.close()`.
	fig, ax = plt.subplots()
	```
